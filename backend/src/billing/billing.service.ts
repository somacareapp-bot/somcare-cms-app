import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { DataSource, Repository, Not } from 'typeorm';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { LabOrder, LabOrderStatus } from '../laboratory/entities/lab-order.entity';
import { LabOrderCharge } from '../laboratory/entities/lab-order-charge.entity';
import { Prescription, PrescriptionStatus } from '../visits/entities/prescription.entity';
import { Visit } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { LabTestCatalog } from '../settings/laboratory/entities/lab-test-catalog.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Service } from './entities/service.entity';
import { RevenueCategory } from './entities/invoice-item.entity';
import { RadiologyOrder, RadiologyOrderStatus } from '../radiology/entities/radiology-order.entity';
import { RadiologyOrderItem } from '../radiology/entities/radiology-order-item.entity';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { ILike } from 'typeorm';

@Injectable()
export class BillingService {
  constructor(
    @InjectRepository(Invoice) private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(InvoiceItem) private readonly itemsRepo: Repository<InvoiceItem>,
    @InjectRepository(Payment) private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(LabOrder) private readonly labOrdersRepo: Repository<LabOrder>,
    @InjectRepository(LabOrderCharge) private readonly labChargesRepo: Repository<LabOrderCharge>,
    @InjectRepository(Prescription) private readonly prescriptionsRepo: Repository<Prescription>,
    @InjectRepository(Visit) private readonly visitsRepo: Repository<Visit>,
    @InjectRepository(Appointment) private readonly appointmentsRepo: Repository<Appointment>,
    @InjectRepository(LabTestCatalog) private readonly labTestCatalogRepo: Repository<LabTestCatalog>,
    @InjectRepository(Patient) private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Medicine) private readonly medicinesRepo: Repository<Medicine>,
    @InjectRepository(Service) private readonly servicesRepo: Repository<Service>,
    @InjectRepository(RadiologyOrder) private readonly radiologyOrdersRepo: Repository<RadiologyOrder>,
    @InjectRepository(RadiologyOrderItem) private readonly radiologyItemsRepo: Repository<RadiologyOrderItem>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  // Unified, searchable catalog for the invoice line-item picker: merges the
  // Services catalog (consultation/procedure/registration/other), the Lab
  // Test Catalog, and the Medicine/Pharmacy catalog into one ranked list, so
  // every billable item in the facility is searchable from one field —
  // matching the item's real revenue category through to the P&L report.
  async searchServices(query?: string) {
    const q = query?.trim();
    const nameFilter = q ? ILike(`%${q}%`) : undefined;

    const [services, labTests, medicines] = await Promise.all([
      this.servicesRepo.find({
        where: nameFilter ? { name: nameFilter, isActive: true } : { isActive: true },
        order: { name: 'ASC' },
        take: 50,
      }),
      this.labTestCatalogRepo.find({
        where: nameFilter ? { name: nameFilter, active: true } : { active: true },
        order: { name: 'ASC' },
        take: 50,
      }),
      this.medicinesRepo.find({
        where: nameFilter ? { name: nameFilter, isActive: true } : { isActive: true },
        order: { name: 'ASC' },
        take: 50,
      }),
    ]);

    const results = [
      ...services.map((s) => ({
        id: s.id,
        name: s.name,
        price: Number(s.price),
        revenueCategory: s.revenueCategory,
        source: 'service' as const,
      })),
      ...labTests
        .filter((t) => !t.isPanel || t.isPanel) // panels and single tests both billable by name
        .map((t) => ({
          id: t.id,
          name: t.name,
          price: Number(t.price),
          revenueCategory: RevenueCategory.LABORATORY,
          source: 'lab_test' as const,
        })),
      ...medicines.map((m) => ({
        id: m.id,
        name: m.name,
        price: Number(m.sellPrice),
        revenueCategory: RevenueCategory.PHARMACY,
        source: 'medicine' as const,
      })),
    ];

    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }

  // Combined Appointment + Lab + Radiology charges for one visit, so Reception
  // can pull these into a manually-built invoice. Each row carries the source
  // entity's id (appointment / LabOrderCharge / RadiologyOrderItem) so the
  // frontend can stamp it as invoiced on save.
  //
  // Only ever returns UNBILLED items: anything with invoicedAt already set is
  // filtered out here, so the same charge can never be loaded into a second
  // invoice — clicking "Load Charges" twice, or two receptionists doing it,
  // simply won't duplicate anything.
  //
  // Lab pricing reads directly from LabOrderCharge — the snapshot LaboratoryService
  // wrote at the moment stock was consumed (price/quantity as they stood then, not
  // whatever the catalog says today). An order only appears here once it has
  // actually been costed (SAMPLE_COLLECTED or later); still-ORDERED orders have no
  // charge rows yet. Voided charges (order cancelled + reversed after costing) are
  // skipped, so a cancelled order can never leak into an invoice.
  async getVisitSummary(visitId: string) {
    const visit = await this.visitsRepo.findOne({ where: { id: visitId } });

    let appointment: { id: string; fee: number } | null = null;
    if (visit?.appointmentId) {
      const appt = await this.appointmentsRepo.findOne({ where: { id: visit.appointmentId } });
      if (appt && !appt.invoicedAt && Number(appt.fee) > 0) {
        appointment = { id: appt.id, fee: Math.round(Number(appt.fee) * 100) / 100 };
      }
    }

    const labOrders = await this.labOrdersRepo.find({
      where: { visitId, status: Not(LabOrderStatus.CANCELLED) },
      relations: ['charges'],
    });

    let labTotal = 0;
    const labItems: { id: string; name: string; price: number }[] = [];
    for (const order of labOrders) {
      for (const charge of order.charges ?? []) {
        if (charge.voidedAt || charge.invoicedAt) continue; // reversed, or already billed
        const price = Math.round(Number(charge.revenue) * 100) / 100;
        labTotal += price;
        labItems.push({ id: charge.id, name: charge.testName, price });
      }
    }
    labTotal = Math.round(labTotal * 100) / 100;

    const radiologyOrders = await this.radiologyOrdersRepo.find({
      where: { visitId, status: Not(RadiologyOrderStatus.CANCELLED) },
      relations: ['items'],
    });

    let radiologyTotal = 0;
    const radiologyItems: { id: string; name: string; price: number }[] = [];
    for (const order of radiologyOrders) {
      for (const item of order.items ?? []) {
        if (item.invoicedAt) continue; // already billed
        const price = Math.round(Number(item.unitPrice) * 100) / 100;
        radiologyTotal += price;
        radiologyItems.push({ id: item.id, name: item.testName, price });
      }
    }
    radiologyTotal = Math.round(radiologyTotal * 100) / 100;

    // Pharmacy is not summarized here — dispense() is the complete
    // transaction (stock + revenue) and never needs to be re-invoiced.
    return {
      visitId,
      appointment,
      appointmentFee: appointment?.fee ?? 0, // kept for older callers
      labTotal,
      labSampleCount: labItems.length,
      labItems,
      radiologyTotal,
      radiologyItems,
    };
  }

  // patientId: optional filter so PatientDetailPage's Invoices tab can pull
  // just this patient's invoices instead of the whole table.
  // search: matches invoice number, patient name (denormalized on the invoice),
  // or the patient's code/phone (looked up via patientId since Invoice doesn't
  // store those directly).
  async getAll(patientId?: string, search?: string) {
    const where: any = patientId ? { patientId } : {};
    const invoices = await this.invoicesRepo.find({ where, order: { createdAt: 'DESC' } });
    if (!search) return invoices;

    const q = search.trim().toLowerCase();
    const patientIds = [...new Set(invoices.map((inv) => inv.patientId).filter(Boolean))];
    const patients = patientIds.length
      ? await this.patientsRepo.findByIds(patientIds)
      : [];
    const patientById = new Map(patients.map((p) => [p.id, p]));

    return invoices.filter((inv) => {
      const patient = patientById.get(inv.patientId);
      return (
        inv.invoiceNumber.toLowerCase().includes(q) ||
        inv.patientName.toLowerCase().includes(q) ||
        (patient?.patientNumber ?? '').toLowerCase().includes(q) ||
        (patient?.phone ?? '').toLowerCase().includes(q)
      );
    });
  }

  async getOne(id: string) {
    const invoice = await this.invoicesRepo.findOne({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async nextInvoiceNumber(): Promise<string> {
    const count = await this.invoicesRepo.count();
    return `INV-${String(count + 1).padStart(6, '0')}`;
  }

  // Creates the invoice, and — in the same transaction — stamps invoicedAt on
  // every source row (Appointment / LabOrderCharge / RadiologyOrderItem) that
  // any line item points back to. A charge is marked billed if and only if
  // the invoice actually saved, and getVisitSummary() will never surface it
  // again after this commits.
  async create(dto: CreateInvoiceDto, userId?: string) {
    const subtotal = dto.items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
    const tax = dto.tax ?? 0;
    const discount = dto.discount ?? 0;
    const total = subtotal + tax - discount;

    return this.dataSource.transaction(async (manager) => {
      const invoicesRepo = manager.getRepository(Invoice);
      const itemsRepo = manager.getRepository(InvoiceItem);
      const appointmentsRepo = manager.getRepository(Appointment);
      const labChargesRepo = manager.getRepository(LabOrderCharge);
      const radiologyItemsRepo = manager.getRepository(RadiologyOrderItem);

      const invoice = invoicesRepo.create({
        invoiceNumber: await this.nextInvoiceNumber(),
        patientId: dto.patientId,
        patientName: dto.patientName,
        paymentMethod: dto.paymentMethod,
        dueDate: new Date(dto.dueDate),
        notes: dto.notes,
        subtotal,
        tax,
        discount,
        total,
        paid: 0,
        status: InvoiceStatus.UNPAID,
        createdBy: userId,
        items: dto.items.map((i) =>
          itemsRepo.create({
            description: i.description,
            qty: i.qty,
            unitPrice: i.unitPrice,
            revenueCategory: i.revenueCategory ?? RevenueCategory.OTHER,
          } as any),
        ) as unknown as InvoiceItem[],
      } as any) as unknown as Invoice;

      const saved = await invoicesRepo.save(invoice);

      const now = new Date();
      for (const item of dto.items) {
        if (!item.sourceId) continue; // manually-typed line item — nothing to stamp
        if (item.sourceType === 'appointment') {
          await appointmentsRepo.update(item.sourceId, { invoicedAt: now });
        } else if (item.sourceType === 'lab_charge') {
          await labChargesRepo.update(item.sourceId, { invoicedAt: now });
        } else if (item.sourceType === 'radiology_item') {
          await radiologyItemsRepo.update(item.sourceId, { invoicedAt: now });
        }
      }

      return saved;
    });
  }

  async recordPayment(id: string, dto: RecordPaymentDto, collectedByName?: string) {
    const invoice = await this.getOne(id);
    const newPaid = Number(invoice.paid) + dto.amount;
    if (newPaid > Number(invoice.total)) {
      throw new BadRequestException('Payment exceeds invoice total');
    }
    invoice.paid = newPaid;
    invoice.status =
      newPaid >= Number(invoice.total)
        ? InvoiceStatus.PAID
        : newPaid > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.UNPAID;
    if (collectedByName) invoice.collectedByName = collectedByName;
    await this.invoicesRepo.save(invoice);

    const payment = this.paymentsRepo.create({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      patientName: invoice.patientName,
      amount: dto.amount,
      paymentMethod: invoice.paymentMethod,
    } as any) as unknown as Payment;
    await this.paymentsRepo.save(payment);

    return invoice;
  }

  async getAllPayments() {
    return this.paymentsRepo.find({ order: { createdAt: 'DESC' } });
  }

  async remove(id: string) {
    const invoice = await this.getOne(id);
    await this.invoicesRepo.remove(invoice);
    return { success: true };
  }
}
