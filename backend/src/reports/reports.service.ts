import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Not, Between, IsNull } from 'typeorm';
import { LabSupplyPurchase as LabPurchaseEntity, LabSupplyPurchaseStatus as LabPurchaseStatus } from '../inventory/entities/lab-supply-purchase.entity';
import { Visit, VisitStatus, VisitUrgency } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Prescription, PrescriptionStatus } from '../visits/entities/prescription.entity';
import { LabOrder, LabOrderStatus } from '../laboratory/entities/lab-order.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Invoice, InvoiceStatus } from '../billing/entities/invoice.entity';
import { Payment } from '../billing/entities/payment.entity';
import { Expense, ExpenseStatus } from '../expenses/entities/expense.entity';
import { Purchase, PurchaseStatus, PurchaseApprovalStatus } from '../pharmacy/entities/purchase.entity';
import { LabSupplyPurchase, LabSupplyPurchaseStatus, LabSupplyPurchaseApprovalStatus } from '../inventory/entities/lab-supply-purchase.entity';
import { Sale, SaleStatus } from '../pharmacy/entities/sale.entity';
import { SaleItem } from '../pharmacy/entities/sale-item.entity';
import { SaleReturn } from '../pharmacy/entities/sale-return.entity';
import { RadiologyOrder, RadiologyOrderStatus } from '../radiology/entities/radiology-order.entity';
import { LabSupplyStockLog, LabSupplyStockLogType } from '../inventory/entities/lab-supply-stock-log.entity';
import { ActivityLog } from '../activity-log/activity-log.entity';
import { LabOrderCharge } from '../laboratory/entities/lab-order-charge.entity';
import { LabSupply } from '../inventory/entities/lab-supply.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Visit)        private readonly visitsRepo: Repository<Visit>,
    @InjectRepository(Appointment)  private readonly appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Prescription) private readonly prescriptionsRepo: Repository<Prescription>,
    @InjectRepository(LabOrder)     private readonly labOrdersRepo: Repository<LabOrder>,
    @InjectRepository(User)         private readonly usersRepo: Repository<User>,
    @InjectRepository(Patient)      private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Medicine)     private readonly medicinesRepo: Repository<Medicine>,
    @InjectRepository(Invoice)      private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(Payment)      private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Expense)      private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(Purchase)     private readonly purchasesRepo: Repository<Purchase>,
    @InjectRepository(LabSupplyPurchase) private readonly labSupplyPurchasesRepo: Repository<LabSupplyPurchase>,
    @InjectRepository(Sale)         private readonly salesRepo: Repository<Sale>,
    @InjectRepository(SaleReturn)   private readonly saleReturnsRepo: Repository<SaleReturn>,
    @InjectRepository(SaleItem)     private readonly saleItemsRepo: Repository<SaleItem>,
    @InjectRepository(RadiologyOrder) private readonly radiologyOrdersRepo: Repository<RadiologyOrder>,
    @InjectRepository(LabSupplyStockLog) private readonly labSupplyStockLogsRepo: Repository<LabSupplyStockLog>,
    @InjectRepository(ActivityLog) private readonly activityLogsRepo: Repository<ActivityLog>,
    @InjectRepository(LabOrderCharge) private readonly labOrderChargesRepo: Repository<LabOrderCharge>,
    @InjectRepository(LabSupply) private readonly labSuppliesRepo: Repository<LabSupply>,
  ) {}

  private todayStart() {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }

  async getAdminDashboard() {
    const today = this.todayStart();

    const [totalPatients, newPatientsToday] = await Promise.all([
      this.patientsRepo.count(),
      this.patientsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
    ]);

    const appointmentsToday = await this.appointmentsRepo.count({
      where: { appointmentDate: today.toISOString().split('T')[0] },
    });

    const allUsers = await this.usersRepo.find({ relations: ['roles'] });
    const allDoctors = allUsers.filter((u: any) =>
      (u.roles ?? []).some((r: any) =>
        (typeof r === 'string' ? r : r.name ?? '').toLowerCase().includes('doctor')
      )
    );
    const activeDoctors = allDoctors.filter((u: any) => u.status === 'active' || u.isActive === true).length;
    const allStaff = allUsers;
    const activeStaff = allStaff.filter((u: any) => u.status === 'active' || u.isActive === true).length;

    const todaysVisits = await this.visitsRepo.find({ where: { createdAt: MoreThanOrEqual(today) } });
    const clinicalActivity = {
      waiting:    todaysVisits.filter(v => v.status === VisitStatus.WAITING).length,
      consulting: todaysVisits.filter(v => v.status === VisitStatus.WITH_DOCTOR).length,
      completed:  todaysVisits.filter(v => v.status === VisitStatus.COMPLETED).length,
      emergency:  todaysVisits.filter(v => v.urgency === VisitUrgency.EMERGENCY).length,
    };

    const patientActivity: { date: string; count: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = await this.visitsRepo
        .createQueryBuilder('v')
        .where('v.created_at >= :d', { d })
        .andWhere('v.created_at < :next', { next })
        .getCount();
      patientActivity.push({ date: d.toISOString().split('T')[0], count });
    }

    const apptList = await this.appointmentsRepo.find({
      where: { appointmentDate: today.toISOString().split('T')[0] },
      relations: ['doctor'],
      order: { appointmentTime: 'ASC' },
      take: 6,
    });

    // Department column is not populated on visits yet — show visit status
    // throughput for the last 30 days instead (always has real data).
    const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30); thirtyDaysAgo.setHours(0,0,0,0);
    const [v30total, v30completed, v30waiting, v30withDoc] = await Promise.all([
      this.visitsRepo.count({ where: { createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.visitsRepo.count({ where: { status: VisitStatus.COMPLETED,   createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.visitsRepo.count({ where: { status: VisitStatus.WAITING,     createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
      this.visitsRepo.count({ where: { status: VisitStatus.WITH_DOCTOR, createdAt: MoreThanOrEqual(thirtyDaysAgo) } }),
    ]);
    const pct = (n: number) => v30total > 0 ? Math.round((n / v30total) * 100) : 0;
    const departmentPerformance = [
      { name: 'Completed',   pct: pct(v30completed), total: v30total,     completed: v30completed },
      { name: 'In Progress', pct: pct(v30withDoc),   total: v30total,     completed: v30withDoc   },
      { name: 'Waiting',     pct: pct(v30waiting),   total: v30total,     completed: v30waiting   },
      { name: 'Other',       pct: pct(v30total - v30completed - v30withDoc - v30waiting),
                             total: v30total, completed: v30total - v30completed - v30withDoc - v30waiting },
    ];

    const lowStockMeds = await this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.stock_quantity <= m.reorder_level')
      .andWhere('m.is_active = true')
      .getCount()
      .catch(() => 0);

    const pendingLabs = await this.labOrdersRepo.count({ where: { status: LabOrderStatus.ORDERED } });
    const pendingPayments = await this.invoicesRepo.count({ where: { status: InvoiceStatus.UNPAID } });

    // ── Revenue data for the admin Accounting section ──────────────────────
    const [totalInvoices, paidCount] = await Promise.all([
      this.invoicesRepo.count(),
      this.invoicesRepo.count({ where: { status: InvoiceStatus.PAID } }),
    ]);

    const todayPaidInvoices = await this.invoicesRepo.find({
      where: { status: InvoiceStatus.PAID, createdAt: MoreThanOrEqual(today) },
    });
    let revenueToday = 0;
    for (const inv of todayPaidInvoices) { revenueToday += Number((inv as any).total ?? (inv as any).amount ?? 0); }

    const unpaidInvoices = await this.invoicesRepo.find({ where: { status: InvoiceStatus.UNPAID } });
    let outstandingBalance = 0;
    for (const inv of unpaidInvoices) { outstandingBalance += Number((inv as any).total ?? (inv as any).amount ?? 0); }

    const revenueByDay: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const rows = await this.invoicesRepo
        .createQueryBuilder('inv')
        .where('inv.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('inv.created_at >= :d', { d })
        .andWhere('inv.created_at < :next', { next })
        .getMany()
        .catch((): Invoice[] => []);
      let amount = 0;
      for (const inv of rows) { amount += Number((inv as any).total ?? (inv as any).amount ?? 0); }
      revenueByDay.push({ date: d.toISOString().split('T')[0], amount: Math.round(amount * 100) / 100 });
    }

    // ── Pending Approvals — live counts across expenses, pharmacy, and lab-supply purchases ──
    const [
      pendingExpenses,
      deptHeadExpenses,
      pendingPharmacyPurchases,
      deptHeadPharmacyPurchases,
      pendingLabPurchases,
      deptHeadLabPurchases,
    ] = await Promise.all([
      this.expensesRepo.count({ where: { status: ExpenseStatus.PENDING } }),
      this.expensesRepo.count({ where: { status: ExpenseStatus.DEPT_HEAD_APPROVED } }),
      this.purchasesRepo.count({ where: { approvalStatus: PurchaseApprovalStatus.SUBMITTED } }).catch(() => 0),
      this.purchasesRepo.count({ where: { approvalStatus: PurchaseApprovalStatus.DEPT_HEAD_APPROVED } }).catch(() => 0),
      this.labSupplyPurchasesRepo.count({ where: { approvalStatus: LabSupplyPurchaseApprovalStatus.SUBMITTED } }).catch(() => 0),
      this.labSupplyPurchasesRepo.count({ where: { approvalStatus: LabSupplyPurchaseApprovalStatus.DEPT_HEAD_APPROVED } }).catch(() => 0),
    ]);
    const pendingApprovalsCount =
      pendingExpenses + deptHeadExpenses +
      pendingPharmacyPurchases + deptHeadPharmacyPurchases +
      pendingLabPurchases + deptHeadLabPurchases;

    const alerts: { level: string; message: string }[] = [];
    if (lowStockMeds > 0) alerts.push({ level: 'red',    message: `${lowStockMeds} medicine${lowStockMeds > 1 ? 's' : ''} low on stock` });
    if (pendingLabs > 0)  alerts.push({ level: 'yellow', message: `${pendingLabs} pending lab test${pendingLabs > 1 ? 's' : ''}` });
    if (pendingPayments > 0) alerts.push({ level: 'blue', message: `${pendingPayments} pending payment${pendingPayments > 1 ? 's' : ''}` });

    const recentActivity: { type: string; message: string; actor?: string; time: string }[] = [];

    const newPatients = await this.patientsRepo.find({ where: { createdAt: MoreThanOrEqual(today) }, order: { createdAt: 'DESC' }, take: 3 });
    for (const p of newPatients) {
      recentActivity.push({ type: 'patient', message: `${p.firstName} ${p.lastName} registered`, time: (p.createdAt as Date).toISOString() });
    }

    const completedVisits = await this.visitsRepo.find({ where: { status: VisitStatus.COMPLETED, createdAt: MoreThanOrEqual(today) }, relations: ['doctor', 'patient'], order: { updatedAt: 'DESC' }, take: 4 });
    for (const v of completedVisits) {
      const docName = v.doctor ? `Dr. ${(v.doctor as any).firstName ?? ''} ${(v.doctor as any).lastName ?? ''}`.trim() : undefined;
      const patName = v.patient ? `${v.patient.firstName} ${v.patient.lastName}` : 'patient';
      recentActivity.push({ type: 'visit', message: `Visit completed — ${patName}`, actor: docName, time: ((v as any).completedAt ?? v.updatedAt ?? v.createdAt).toISOString() });
    }

    const completedLabs = await this.labOrdersRepo.find({ where: { status: LabOrderStatus.COMPLETED, createdAt: MoreThanOrEqual(today) }, relations: ['patient'], order: { updatedAt: 'DESC' }, take: 3 });
    for (const l of completedLabs) {
      const patName = l.patient ? `${l.patient.firstName} ${l.patient.lastName}` : 'patient';
      recentActivity.push({ type: 'lab', message: `Lab result approved — ${patName}`, actor: (l as any).verifiedByName ?? undefined, time: ((l as any).completedAt ?? l.updatedAt ?? l.createdAt).toISOString() });
    }

    const dispensed = await this.prescriptionsRepo.find({ where: { status: PrescriptionStatus.DISPENSED, createdAt: MoreThanOrEqual(today) }, relations: ['visit', 'visit.patient'], order: { createdAt: 'DESC' } as any, take: 3 });
    for (const rx of dispensed) {
      const patName = rx.visit?.patient ? `${rx.visit.patient.firstName} ${rx.visit.patient.lastName}` : 'patient';
      recentActivity.push({ type: 'pharmacy', message: `Prescription issued — ${patName}`, actor: (rx as any).dispensedByName ?? undefined, time: ((rx as any).dispensedAt ?? rx.createdAt).toISOString() });
    }

    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      scope: 'admin' as const,
      kpis: { totalPatients, newPatientsToday, appointmentsToday, totalDoctors: allDoctors.length, activeDoctors, totalStaff: allStaff.length, activeStaff },
      clinicalActivity,
      patientActivity,
      appointmentsToday: apptList.map(a => ({
        id: a.id,
        time: a.appointmentTime,
        doctorName: a.doctor ? `Dr. ${(a.doctor as any).firstName ?? ''} ${(a.doctor as any).lastName ?? ''}`.trim() : 'Unassigned',
        status: a.status,
        type: a.type,
      })),
      departmentPerformance,
      alerts,
      recentActivity: recentActivity.slice(0, 8),
      revenueToday: Math.round(revenueToday * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      revenueByDay,
      totalInvoices,
      paidCount,
      unpaidCount: pendingPayments,
      pendingApprovalsCount,
    };
  }

  async getDoctorDashboard(doctorId: string) {
    const today = this.todayStart();

    const totalPatientsRow = await this.visitsRepo.createQueryBuilder('v').select('COUNT(DISTINCT v.patient_id)', 'count').where('v.doctor_id = :doctorId', { doctorId }).getRawOne();
    const totalPatients = parseInt(totalPatientsRow?.count ?? '0', 10) || 0;

    const [todaysVisits, currentlyWithYou, todaysAppointments] = await Promise.all([
      this.visitsRepo.count({ where: { doctorId, createdAt: MoreThanOrEqual(today) } as any }),
      this.visitsRepo.count({ where: { doctorId, status: VisitStatus.WITH_DOCTOR } as any }),
      this.appointmentsRepo.count({ where: { doctorId, appointmentDate: today.toISOString().split('T')[0] } as any }),
    ]);

    const [labTotal, labPending] = await Promise.all([
      this.labOrdersRepo.createQueryBuilder('l').innerJoin('l.visit', 'v').where('v.doctor_id = :doctorId', { doctorId }).getCount(),
      this.labOrdersRepo.createQueryBuilder('l').innerJoin('l.visit', 'v').where('v.doctor_id = :doctorId', { doctorId }).andWhere('l.status = :status', { status: LabOrderStatus.ORDERED }).getCount(),
    ]);

    const [rxTotal, rxDispensed] = await Promise.all([
      this.prescriptionsRepo.createQueryBuilder('rx').innerJoin('rx.visit', 'v').where('v.doctor_id = :doctorId', { doctorId }).getCount(),
      this.prescriptionsRepo.createQueryBuilder('rx').innerJoin('rx.visit', 'v').where('v.doctor_id = :doctorId', { doctorId }).andWhere('rx.status = :status', { status: PrescriptionStatus.DISPENSED }).getCount(),
    ]);

    return { scope: 'doctor' as const, totalPatients, todaysVisits, currentlyWithYou, todaysAppointments, labRequests: { pending: labPending, total: labTotal }, prescriptions: { dispensed: rxDispensed, total: rxTotal } };
  }

  async getNurseDashboard() {
    const today = this.todayStart();

    const [todaysVisits, waitingForTriage, inTriage, todaysAppointments] = await Promise.all([
      this.visitsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.visitsRepo.count({ where: { status: VisitStatus.WAITING } }),
      this.visitsRepo.count({ where: { status: VisitStatus.IN_TRIAGE } }),
      this.appointmentsRepo.count({ where: { appointmentDate: today.toISOString().split('T')[0] } }),
    ]);

    const emergencyCases = await this.visitsRepo.count({ where: { urgency: VisitUrgency.EMERGENCY, createdAt: MoreThanOrEqual(today) } });

    return { scope: 'nurse' as const, todaysVisits, waitingForTriage, inTriage, emergencyCases, todaysAppointments };
  }

  async getReceptionistDashboard() {
    const today = this.todayStart();
    const todayStr = today.toISOString().split('T')[0];

    const [todaysAppointments, checkedInToday, newPatientsToday, waitingPatients] = await Promise.all([
      this.appointmentsRepo.count({ where: { appointmentDate: todayStr } }),
      this.visitsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.patientsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.visitsRepo.count({ where: { status: VisitStatus.WAITING } }),
    ]);

    const upcomingAppointments = await this.appointmentsRepo.find({ where: { appointmentDate: todayStr }, relations: ['doctor'], order: { appointmentTime: 'ASC' }, take: 8 });

    return {
      scope: 'receptionist' as const,
      todaysAppointments, checkedInToday, newPatientsToday, waitingPatients,
      upcomingAppointments: upcomingAppointments.map(a => ({
        id: a.id, time: a.appointmentTime,
        doctorName: a.doctor ? `Dr. ${(a.doctor as any).firstName ?? ''} ${(a.doctor as any).lastName ?? ''}`.trim() : 'Unassigned',
        status: a.status, type: a.type,
      })),
    };
  }

  // ── Pharmacist dashboard ────────────────────────────────────────────────
  async getPharmacistDashboard() {
    const today = this.todayStart();

    const [totalMedicines, lowStockCount, pendingCount, dispensedToday] = await Promise.all([
      this.medicinesRepo.count({ where: { isActive: true } as any }).catch(() => this.medicinesRepo.count()),
      this.medicinesRepo.createQueryBuilder('m').where('m.stock_quantity <= m.reorder_level').getCount().catch(() => 0),
      this.prescriptionsRepo.count({ where: { status: PrescriptionStatus.PENDING } }),
      this.prescriptionsRepo.count({ where: { status: PrescriptionStatus.DISPENSED, createdAt: MoreThanOrEqual(today) } }),
    ]);

    // Low-stock items list (up to 8)
    const lowStockItems = await this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.stock_quantity <= m.reorder_level')
      .orderBy('m.stock_quantity', 'ASC')
      .take(8)
      .getMany()
      .catch(() => []);

    return {
      scope: 'pharmacist' as const,
      totalMedicines,
      lowStockCount,
      pendingCount,
      dispensedToday,
      lowStockItems: lowStockItems.map((m: any) => ({
        id: m.id,
        name: m.name ?? m.genericName ?? 'Unknown',
        stock: m.stockQuantity ?? m.stock_quantity ?? 0,
        reorderLevel: m.reorderLevel ?? m.reorder_level ?? 0,
      })),
    };
  }

  // ── Accountant dashboard ────────────────────────────────────────────────
  async getAccountantDashboard() {
    const today = this.todayStart();

    const [totalInvoices, paidCount, unpaidCount, partialCount] = await Promise.all([
      this.invoicesRepo.count(),
      this.invoicesRepo.count({ where: { status: InvoiceStatus.PAID } }),
      this.invoicesRepo.count({ where: { status: InvoiceStatus.UNPAID } }),
      this.invoicesRepo.count({ where: { status: InvoiceStatus.PARTIAL } }).catch(() => 0),
    ]);

    // Today's revenue from paid invoices
    const todayPaidInvoices = await this.invoicesRepo.find({
      where: { status: InvoiceStatus.PAID, createdAt: MoreThanOrEqual(today) },
    });
    let revenueToday = 0;
    for (const inv of todayPaidInvoices) { revenueToday += Number((inv as any).total ?? (inv as any).amount ?? 0); }

    // Outstanding balance from unpaid invoices
    const unpaidInvoices = await this.invoicesRepo.find({ where: { status: InvoiceStatus.UNPAID } });
    let outstandingBalance = 0;
    for (const inv of unpaidInvoices) { outstandingBalance += Number((inv as any).total ?? (inv as any).amount ?? 0); }

    // Revenue last 7 days
    const revenueByDay: { date: string; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const rows = await this.invoicesRepo
        .createQueryBuilder('inv')
        .where('inv.status = :status', { status: InvoiceStatus.PAID })
        .andWhere('inv.created_at >= :d', { d })
        .andWhere('inv.created_at < :next', { next })
        .getMany()
        .catch((): Invoice[] => []);
      let amount = 0;
      for (const inv of rows) { amount += Number((inv as any).total ?? (inv as any).amount ?? 0); }
      revenueByDay.push({ date: d.toISOString().split('T')[0], amount: Math.round(amount * 100) / 100 });
    }

    return {
      scope: 'accountant' as const,
      totalInvoices,
      paidCount,
      unpaidCount,
      partialCount,
      revenueToday: Math.round(revenueToday * 100) / 100,
      outstandingBalance: Math.round(outstandingBalance * 100) / 100,
      revenueByDay,
    };
  }


  // ── Laboratory dashboard ────────────────────────────────────────────────
  async getLaboratoryDashboard() {
    const today = this.todayStart();

    const [totalOrders, pendingOrders, inProgressOrders, completedToday, criticalCount] = await Promise.all([
      this.labOrdersRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.labOrdersRepo.count({ where: { status: LabOrderStatus.ORDERED } }),
      this.labOrdersRepo.count({ where: { status: LabOrderStatus.IN_PROGRESS } }).catch(() =>
        Promise.resolve(0)
      ),
      this.labOrdersRepo.count({ where: { status: LabOrderStatus.COMPLETED, createdAt: MoreThanOrEqual(today) } }),
      this.labOrdersRepo.count({ where: { status: LabOrderStatus.ORDERED } }), // fallback — no critical field assumed
    ]);

    const recentOrders = await this.labOrdersRepo.find({
      where: { createdAt: MoreThanOrEqual(today) },
      relations: ['patient'],
      order: { createdAt: 'DESC' },
      take: 8,
    });

    return {
      scope: 'laboratory' as const,
      totalOrders,
      pendingOrders,
      inProgressOrders,
      completedToday,
      recentOrders: recentOrders.map(o => ({
        id: o.id,
        patientName: o.patient ? `${o.patient.firstName} ${o.patient.lastName}` : 'Unknown',
        testName: (o as any).testName ?? (o as any).test ?? (o as any).name ?? 'Lab Test',
        status: o.status,
        createdAt: (o.createdAt as Date).toISOString(),
      })),
    };
  }

  async getFacilityDashboard() {
    const today = this.todayStart();
    const [totalPatients, todayVisits, pendingLabs, pendingPrescriptions] = await Promise.all([
      this.patientsRepo.count(),
      this.visitsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.labOrdersRepo.count({ where: { status: LabOrderStatus.ORDERED } }),
      this.prescriptionsRepo.count({ where: { status: PrescriptionStatus.PENDING } }),
    ]);
    return { totalPatients, todayVisits, pendingLabs, pendingPrescriptions };
  }

  // ── Profit & Loss ────────────────────────────────────────────────────────
  // Income  = actual payments received (invoice_payments table), by their created_at.
  // Expenses = only APPROVED expenses (their own `date` field) — pending/sent-back/
  //            rejected expenses are not confirmed outflows yet.
  async getProfitLoss(from?: string, to?: string) {
    const fromDate = from
      ? new Date(from)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 29); return d; })();
    fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    // ── Revenue by category — read straight from invoice_items ────────────
    // Each invoice item carries a revenue_category (consultation, laboratory,
    // pharmacy, procedure, registration, other). We sum qty * unit_price per
    // category for every invoice created in the selected date range, so the
    // P&L's Revenue / Income section reflects real invoice data instead of
    // being derived from payments.
    const invoicesForRevenue = await this.invoicesRepo
      .createQueryBuilder('inv')
      .leftJoinAndSelect('inv.items', 'items')
      .where('inv.created_at >= :fromDate', { fromDate })
      .andWhere('inv.created_at <= :toDate', { toDate })
      .getMany();

    const revenueByCategoryMap: Record<string, number> = {};
    for (const inv of invoicesForRevenue) {
      for (const item of (inv as any).items ?? []) {
        const cat = item.revenueCategory || 'other';
        // Pharmacy revenue is pulled directly from sales + dispensed prescriptions
        // below, so skip pharmacy-tagged invoice items here to avoid double-counting.
        if (cat === 'pharmacy') continue;
        const lineAmount = Number(item.qty ?? 1) * Number(item.unitPrice ?? 0);
        revenueByCategoryMap[cat] = Math.round(((revenueByCategoryMap[cat] || 0) + lineAmount) * 100) / 100;
      }
    }

    // ── Pharmacy revenue (POS sales + RX dispensing) — these never create
    // invoices, so pull them directly here instead of from invoice_items.
    const posSalesForRevenue = await this.salesRepo
      .createQueryBuilder('s')
      .where('s.created_at >= :fromDate', { fromDate })
      .andWhere('s.created_at <= :toDate', { toDate })
      .andWhere('s.status != :voided', { voided: SaleStatus.VOIDED })
      .getMany();
    const totalPosRevenue = posSalesForRevenue.reduce((sum, s) => sum + Number(s.totalAmount), 0);

    const dispensedRxForRevenue = await this.prescriptionsRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.medicine', 'medicine')
      .where('p.status = :status', { status: PrescriptionStatus.DISPENSED })
      .andWhere('p.dispensed_at >= :fromDate', { fromDate })
      .andWhere('p.dispensed_at <= :toDate', { toDate })
      .getMany();
    // Prefer the price snapshot taken at dispense time — falls back to a
    // live join only for rows dispensed before that column existed, so old
    // reports keep working without a backfill.
    const totalRxRevenue = dispensedRxForRevenue.reduce((sum, p) => {
      if (p.subtotal != null) return sum + Number(p.subtotal);
      return sum + Number(p.quantity ?? 0) * Number((p as any).medicine?.sellPrice ?? 0);
    }, 0);

    const totalPharmacyRevenue = totalPosRevenue + totalRxRevenue;
    if (totalPharmacyRevenue > 0) {
      revenueByCategoryMap['pharmacy'] =
        Math.round(((revenueByCategoryMap['pharmacy'] || 0) + totalPharmacyRevenue) * 100) / 100;
    }

    // Returns reduce pharmacy revenue and are shown as their own line so
    // the deduction is visible in the statement rather than silently netted.
    const returnsForRevenue = await this.saleReturnsRepo
      .createQueryBuilder('r')
      .where('r.created_at >= :fromDate', { fromDate })
      .andWhere('r.created_at <= :toDate', { toDate })
      .getMany();
    const totalReturns = returnsForRevenue.reduce((sum, r) => sum + Number(r.refundAmount ?? 0), 0);
    if (totalReturns > 0) {
      revenueByCategoryMap['returns'] =
        Math.round(((revenueByCategoryMap['returns'] || 0) - totalReturns) * 100) / 100;
    }

    // Radiology revenue — same pattern as pharmacy: recognized at completion
    // (costedAt set), read from the snapshot on the order, filtered by
    // completedAt so an order finished after the range doesn't leak in early.
    const completedRadiologyOrders = await this.radiologyOrdersRepo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: RadiologyOrderStatus.COMPLETED })
      .andWhere('r.completed_at >= :fromDate', { fromDate })
      .andWhere('r.completed_at <= :toDate', { toDate })
      .getMany();
    const totalRadiologyRevenue = completedRadiologyOrders.reduce(
      (sum, o) => sum + Number(o.totalRevenue ?? 0),
      0,
    );
    if (totalRadiologyRevenue > 0) {
      revenueByCategoryMap['radiology'] =
        Math.round(((revenueByCategoryMap['radiology'] || 0) + totalRadiologyRevenue) * 100) / 100;
    }

    const totalRevenueFromInvoices = Object.values(revenueByCategoryMap).reduce((s, v) => s + v, 0);

    const payments = await this.paymentsRepo
      .createQueryBuilder('p')
      .where('p.created_at >= :fromDate', { fromDate })
      .andWhere('p.created_at <= :toDate', { toDate })
      .getMany();

    const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const incomeByMethod: Record<string, number> = {};
    for (const p of payments) {
      const method = p.paymentMethod || 'unknown';
      incomeByMethod[method] = Math.round(((incomeByMethod[method] || 0) + Number(p.amount)) * 100) / 100;
    }

    const expenses = await this.expensesRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: ExpenseStatus.APPROVED })
      .andWhere('e.date >= :fromStr', { fromStr })
      .andWhere('e.date <= :toStr', { toStr })
      .getMany();

    // Confirmed pharmacy purchases (goods actually received — confirmPurchase()
    // is what increments stock) feed Cost of Sales as real 'Medicines Purchased'
    // spend, keyed by confirmed_at, not created_at — a still-pending purchase
    // hasn't cost the business anything yet.
    const confirmedPurchases = await this.purchasesRepo
      .createQueryBuilder('pur')
      .where('pur.status = :status', { status: PurchaseStatus.CONFIRMED })
      .andWhere('pur.confirmed_at >= :fromDate', { fromDate })
      .andWhere('pur.confirmed_at <= :toDate', { toDate })
      .getMany();
    const totalMedicinePurchases = confirmedPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);

    // Confirmed laboratory supply purchases (goods actually received) feed
    // Cost of Sales as 'Laboratory Supplies' spend, same rule as pharmacy:
    // keyed by confirmed_at, not created_at.
    const confirmedLabSupplyPurchases = await this.labSupplyPurchasesRepo
      .createQueryBuilder('lspur')
      .where('lspur.status = :status', { status: LabSupplyPurchaseStatus.CONFIRMED })
      .andWhere('lspur.confirmed_at >= :fromDate', { fromDate })
      .andWhere('lspur.confirmed_at <= :toDate', { toDate })
      .getMany();
    const totalLabSupplyPurchases = confirmedLabSupplyPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0);

    // Cost of Medicines Sold — sum of (cost_price × quantity) from sale_items
    // within the period. This is the true COGS for pharmacy sales, distinct from
    // 'Medicines Purchased' which is stock arrivals (purchase orders).
    const soldItemsForCogs = await this.saleItemsRepo
      .createQueryBuilder('si')
      .innerJoin('si.sale', 's')
      .where('s.created_at >= :fromDate', { fromDate })
      .andWhere('s.created_at <= :toDate', { toDate })
      .getMany();
    const totalCostOfMedicinesSold = Math.round(
      soldItemsForCogs.reduce((sum, si) => sum + Number(si.costPrice ?? 0) * Number(si.quantity), 0) * 100,
    ) / 100;

    const totalExpenses =
      expenses.reduce((sum, e) => sum + Number(e.amount), 0) +
      totalMedicinePurchases +
      totalLabSupplyPurchases +
      totalCostOfMedicinesSold;

    const expensesByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = Math.round(((expensesByCategory[e.category] || 0) + Number(e.amount)) * 100) / 100;
    }
    if (totalMedicinePurchases > 0) {
      expensesByCategory['medicine_purchases'] =
        Math.round(((expensesByCategory['medicine_purchases'] || 0) + totalMedicinePurchases) * 100) / 100;
    }
    if (totalLabSupplyPurchases > 0) {
      expensesByCategory['lab_supplies_purchases'] =
        Math.round(((expensesByCategory['lab_supplies_purchases'] || 0) + totalLabSupplyPurchases) * 100) / 100;
    }
    if (totalCostOfMedicinesSold > 0) {
      expensesByCategory['cost_of_medicines_sold'] =
        Math.round(((expensesByCategory['cost_of_medicines_sold'] || 0) + totalCostOfMedicinesSold) * 100) / 100;
    }

    const dayKey = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);

    const byDay: { date: string; income: number; expenses: number; net: number }[] = [];
    const cursor = new Date(fromDate);
    const endCursor = new Date(toDate);
    endCursor.setHours(0, 0, 0, 0);
    while (cursor <= endCursor) {
      const dStr = dayKey(cursor);
      const dayIncome = payments
        .filter((p) => dayKey(p.createdAt as any) === dStr)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const dayExpenses =
        expenses
          .filter((e) => dayKey(e.date as any) === dStr)
          .reduce((sum, e) => sum + Number(e.amount), 0) +
        confirmedPurchases
          .filter((p) => dayKey(p.confirmedAt as any) === dStr)
          .reduce((sum, p) => sum + Number(p.totalAmount), 0) +
        confirmedLabSupplyPurchases
          .filter((p) => dayKey(p.confirmedAt as any) === dStr)
          .reduce((sum, p) => sum + Number(p.totalAmount), 0);
      byDay.push({
        date: dStr,
        income: Math.round(dayIncome * 100) / 100,
        expenses: Math.round(dayExpenses * 100) / 100,
        net: Math.round((dayIncome - dayExpenses) * 100) / 100,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      from: fromStr,
      to: toStr,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round((totalIncome - totalExpenses) * 100) / 100,
      byPaymentMethod: Object.entries(incomeByMethod).map(([method, amount]) => ({ method, amount })),
      byCategory: Object.entries(expensesByCategory).map(([category, amount]) => ({ category, amount })),
      byRevenueCategory: Object.entries(revenueByCategoryMap).map(([category, amount]) => ({ category, amount })),
      totalRevenueFromInvoices: Math.round(totalRevenueFromInvoices * 100) / 100,
      byDay,
      paymentsCount: payments.length,
      approvedExpensesCount: expenses.length,
      confirmedPurchasesCount: confirmedPurchases.length,
      confirmedLabSupplyPurchasesCount: confirmedLabSupplyPurchases.length,
      totalCostOfMedicinesSold: Math.round(totalCostOfMedicinesSold * 100) / 100,
    };
  }

  // ───────────────────────── Monthly reports ─────────────────────────

  private pad2(n: number) { return String(n).padStart(2, '0'); }
  private ymd(d: Date) { return `${d.getFullYear()}-${this.pad2(d.getMonth() + 1)}-${this.pad2(d.getDate())}`; }

  /** from/to = 'YYYY-MM-DD'. Defaults to the 1st of the current month through today. */
  private resolveDateRange(from?: string, to?: string) {
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    let startDate: string;
    let endDate: string;
    if (from || to) {
      if (!from || !to) throw new BadRequestException('Both from and to are required');
      if (!dateRe.test(from) || !dateRe.test(to)) throw new BadRequestException('from/to must be in YYYY-MM-DD format');
      if (from > to) throw new BadRequestException('from must not be after to');
      startDate = from;
      endDate = to;
    } else {
      const now = new Date();
      startDate = `${now.getFullYear()}-${this.pad2(now.getMonth() + 1)}-01`;
      endDate = this.ymd(now);
    }
    const [sy, sm, sd] = startDate.split('-').map(Number);
    const [ey, em, ed] = endDate.split('-').map(Number);
    const start = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
    const endInclusive = new Date(ey, em - 1, ed, 23, 59, 59, 999);
    const days: string[] = [];
    for (let d = new Date(start); d <= endInclusive; d.setDate(d.getDate() + 1)) {
      days.push(this.ymd(d));
    }
    return {
      from: startDate,
      to: endDate,
      start,
      endInclusive,
      startDate,
      endDate,
      days,
    };
  }

  private countBy<T>(items: T[], key: (i: T) => string | null | undefined): { key: string; count: number }[] {
    const map: Record<string, number> = {};
    for (const it of items) {
      const k = key(it) || 'unknown';
      map[k] = (map[k] ?? 0) + 1;
    }
    return Object.entries(map).map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);
  }

  private dailySeries<T>(days: string[], items: T[], dateOf: (i: T) => Date | string | null | undefined) {
    const map: Record<string, number> = {};
    for (const it of items) {
      const raw = dateOf(it);
      if (!raw) continue;
      const k = typeof raw === 'string' ? raw.slice(0, 10) : this.ymd(new Date(raw));
      map[k] = (map[k] ?? 0) + 1;
    }
    return days.map(date => ({ date, count: map[date] ?? 0 }));
  }

  async getMonthlyVisitsReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const [visits, newPatients, appointmentsBooked] = await Promise.all([
      this.visitsRepo.find({ where: { createdAt: Between(r.start, r.endInclusive) }, relations: ['doctor'] }),
      this.patientsRepo.find({ where: { createdAt: Between(r.start, r.endInclusive) } }),
      this.appointmentsRepo.count({ where: { appointmentDate: Between(r.startDate, r.endDate) } }),
    ]);

    const doctorLabel = (v: Visit) => {
      const d: any = v.doctor;
      if (!d) return 'Unassigned';
      return d.fullName ?? ([d.firstName, d.lastName].filter(Boolean).join(' ') || d.username || d.email || v.doctorId);
    };

    return {
      range: { from: r.from, to: r.to },
      totals: {
        visits: visits.length,
        completed: visits.filter(v => v.status === VisitStatus.COMPLETED).length,
        cancelled: visits.filter(v => v.status === VisitStatus.CANCELLED).length,
        emergency: visits.filter(v => v.urgency === VisitUrgency.EMERGENCY).length,
        newPatients: newPatients.length,
        appointmentsBooked,
      },
      byStatus: this.countBy(visits, v => v.status),
      byUrgency: this.countBy(visits, v => v.urgency),
      byDepartment: this.countBy(visits, v => v.department),
      byDoctor: this.countBy(visits, doctorLabel),
      newPatientsByGender: this.countBy(newPatients, p => p.gender),
      daily: this.dailySeries(r.days, visits, v => v.createdAt),
    };
  }

  async getMonthlyExpensesReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const expenses = await this.expensesRepo.find({
      where: { date: Between(r.startDate as any, r.endDate as any) },
    });

    const sum = (list: Expense[]) => list.reduce((s, e) => s + Number(e.amount || 0), 0);
    const round = (n: number) => Math.round(n * 100) / 100;

    const byCategoryMap: Record<string, { count: number; total: number }> = {};
    for (const e of expenses) {
      const k = e.category || 'other';
      byCategoryMap[k] ??= { count: 0, total: 0 };
      byCategoryMap[k].count += 1;
      byCategoryMap[k].total += Number(e.amount || 0);
    }

    const byStatusMap: Record<string, { count: number; total: number }> = {};
    for (const e of expenses) {
      byStatusMap[e.status] ??= { count: 0, total: 0 };
      byStatusMap[e.status].count += 1;
      byStatusMap[e.status].total += Number(e.amount || 0);
    }

    return {
      range: { from: r.from, to: r.to },
      totals: {
        count: expenses.length,
        submittedAmount: round(sum(expenses)),
        paidAmount: round(sum(expenses.filter(e => e.status === ExpenseStatus.PAID))),
        awaitingApprovalAmount: round(sum(expenses.filter(e =>
          e.status === ExpenseStatus.PENDING || e.status === ExpenseStatus.DEPT_HEAD_APPROVED))),
        approvedUnpaidAmount: round(sum(expenses.filter(e => e.status === ExpenseStatus.APPROVED))),
        rejectedAmount: round(sum(expenses.filter(e =>
          e.status === ExpenseStatus.REJECTED || e.status === ExpenseStatus.DEPT_HEAD_REJECTED))),
      },
      byCategory: Object.entries(byCategoryMap)
        .map(([category, v]) => ({ category, count: v.count, total: round(v.total) }))
        .sort((a, b) => b.total - a.total),
      byStatus: Object.entries(byStatusMap)
        .map(([status, v]) => ({ status, count: v.count, total: round(v.total) })),
      daily: this.dailySeries(r.days, expenses, e => e.date as any),
    };
  }

  async getMonthlyLabSuppliesReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const logs = await this.labSupplyStockLogsRepo.find({
      where: { createdAt: Between(r.start, r.endInclusive) },
      relations: ['labSupply'],
    });

    // Confirmed lab-supply purchases are real restocks, but the purchase flow does not
    // write a stock-log entry, so read them directly (same approach as the pharmacy report).
    const labPurchases = await this.labSupplyStockLogsRepo.manager.getRepository(LabPurchaseEntity).find({
      where: [
        { status: LabPurchaseStatus.CONFIRMED, confirmedAt: Between(r.start, r.endInclusive) },
        { status: LabPurchaseStatus.CONFIRMED, confirmedAt: IsNull(), createdAt: Between(r.start, r.endInclusive) },
      ],
      relations: ['items', 'items.labSupply'],
    });
    const purchaseMoves: { createdAt: Date }[] = [];
    let purchaseRestockQty = 0;
    let purchaseRestockCost = 0;

    const cost = (l: LabSupplyStockLog) =>
      Number(l.totalCost ?? (Number(l.unitCost ?? 0) * Number(l.quantity || 0)));
    const round = (n: number) => Math.round(n * 100) / 100;

    const restocks = logs.filter(l => l.type === LabSupplyStockLogType.RESTOCK);
    const issues = logs.filter(l => l.type === LabSupplyStockLogType.ISSUE);
    const autoLab = issues.filter(l => l.referenceType === 'lab_order');

    const perSupply: Record<string, {
      supplyId: string; name: string; unit: string;
      restockedQty: number; restockedCost: number; issuedQty: number; issuedCost: number;
      currentStock: number;
    }> = {};
    for (const l of logs) {
      const s = (perSupply[l.labSupplyId] ??= {
        supplyId: l.labSupplyId,
        name: (l.labSupply as any)?.name ?? l.labSupplyId,
        unit: (l.labSupply as any)?.unit ?? 'unit',
        restockedQty: 0, restockedCost: 0, issuedQty: 0, issuedCost: 0,
        currentStock: Number((l.labSupply as any)?.stockQuantity ?? 0),
      });
      if (l.type === LabSupplyStockLogType.RESTOCK) {
        s.restockedQty += Number(l.quantity || 0);
        s.restockedCost += cost(l);
      } else {
        s.issuedQty += Number(l.quantity || 0);
        s.issuedCost += cost(l);
      }
    }

    for (const p of labPurchases) {
      const when = p.confirmedAt ?? p.createdAt;
      for (const it of p.items ?? []) {
        const qty = Number(it.quantity || 0);
        const itemCost = it.subtotal != null ? Number(it.subtotal) : qty * Number(it.costPrice || 0);
        const s = (perSupply[it.labSupplyId] ??= {
          supplyId: it.labSupplyId,
          name: (it.labSupply as any)?.name ?? it.labSupplyId,
          unit: (it.labSupply as any)?.unit ?? 'unit',
          restockedQty: 0, restockedCost: 0, issuedQty: 0, issuedCost: 0,
          currentStock: Number((it.labSupply as any)?.stockQuantity ?? 0),
        });
        s.restockedQty += qty;
        s.restockedCost += itemCost;
        purchaseRestockQty += qty;
        purchaseRestockCost += itemCost;
        purchaseMoves.push({ createdAt: when });
      }
    }
    const dailyRows: { createdAt: Date }[] = [...logs, ...purchaseMoves];

    return {
      range: { from: r.from, to: r.to },
      totals: {
        movements: logs.length + purchaseMoves.length,
        restockedQty: restocks.reduce((s, l) => s + Number(l.quantity || 0), 0) + purchaseRestockQty,
        restockedCost: round(restocks.reduce((s, l) => s + cost(l), 0) + purchaseRestockCost),
        issuedQty: issues.reduce((s, l) => s + Number(l.quantity || 0), 0),
        issuedCost: round(issues.reduce((s, l) => s + cost(l), 0)),
        autoConsumedByLabOrders: autoLab.length,
        autoConsumedCost: round(autoLab.reduce((s, l) => s + cost(l), 0)),
      },
      bySupply: Object.values(perSupply)
        .map(s => {
          const endingQty = s.currentStock;
          const openingQty = endingQty - s.restockedQty + s.issuedQty;
          return {
            ...s,
            restockedCost: round(s.restockedCost),
            issuedCost: round(s.issuedCost),
            openingQty,
            endingQty,
          };
        })
        .sort((a, b) => b.issuedCost - a.issuedCost),
      daily: this.dailySeries(r.days, dailyRows, l => l.createdAt),
    };
  }

  async getMonthlyStaffActivityReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const logs = await this.activityLogsRepo.find({
      where: { createdAt: Between(r.start, r.endInclusive) },
    });

    const perUser: Record<string, {
      userId: string | null; userName: string; userRole: string | null;
      total: number; actions: Record<string, number>; lastActive: Date | null;
    }> = {};
    for (const l of logs) {
      const key = l.userId ?? l.userName ?? 'unknown';
      const u = (perUser[key] ??= {
        userId: l.userId,
        userName: l.userName ?? 'Unknown',
        userRole: l.userRole,
        total: 0,
        actions: {},
        lastActive: null,
      });
      u.total += 1;
      u.actions[l.action] = (u.actions[l.action] ?? 0) + 1;
      if (!u.lastActive || l.createdAt > u.lastActive) u.lastActive = l.createdAt;
    }

    return {
      range: { from: r.from, to: r.to },
      totals: {
        actions: logs.length,
        activeStaff: Object.keys(perUser).length,
      },
      byStaff: Object.values(perUser).sort((a, b) => b.total - a.total),
      byAction: this.countBy(logs, l => l.action),
      byEntityType: this.countBy(logs, l => l.entityType),
      daily: this.dailySeries(r.days, logs, l => l.createdAt),
    };
  }


  // ───────────────────────── Diagnosis summary ─────────────────────────

  async getMonthlyDiagnosisReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const visits = await this.visitsRepo.find({
      where: { createdAt: Between(r.start, r.endInclusive) },
    });
    const withDiagnosis = visits.filter(v => v.diagnosis && v.diagnosis.trim().length > 0);

    return {
      range: { from: r.from, to: r.to },
      totals: {
        totalVisits: visits.length,
        diagnosedVisits: withDiagnosis.length,
        undocumented: visits.length - withDiagnosis.length,
      },
      byDiagnosis: this.countBy(withDiagnosis, v => v.diagnosis),
      daily: this.dailySeries(r.days, withDiagnosis, v => v.createdAt),
    };
  }

  // ───────────────────────── Lab revenue & cost ─────────────────────────

  async getMonthlyLabRevenueReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const charges = await this.labOrderChargesRepo.find({
      where: { createdAt: Between(r.start, r.endInclusive), voidedAt: IsNull() },
    });
    const round = (n: number) => Math.round(n * 100) / 100;

    const totalRevenue = charges.reduce((s, c) => s + Number(c.revenue || 0), 0);
    const totalCost = charges.reduce((s, c) => s + Number(c.cost || 0), 0);

    const byTestMap: Record<string, { testName: string; count: number; revenue: number; cost: number }> = {};
    for (const c of charges) {
      const key = c.testName || 'Unknown';
      const t = (byTestMap[key] ??= { testName: key, count: 0, revenue: 0, cost: 0 });
      t.count += Number(c.quantity || 1);
      t.revenue += Number(c.revenue || 0);
      t.cost += Number(c.cost || 0);
    }

    return {
      range: { from: r.from, to: r.to },
      totals: {
        testsCompleted: charges.length,
        totalRevenue: round(totalRevenue),
        totalCost: round(totalCost),
        grossProfit: round(totalRevenue - totalCost),
        marginPct: totalRevenue > 0 ? round(((totalRevenue - totalCost) / totalRevenue) * 100) : 0,
        unconfiguredTests: charges.filter(c => !c.hasRecipe).length,
      },
      byTest: Object.values(byTestMap)
        .map(t => ({ ...t, revenue: round(t.revenue), cost: round(t.cost), grossProfit: round(t.revenue - t.cost) }))
        .sort((a, b) => b.revenue - a.revenue),
      daily: this.dailySeries(r.days, charges, c => c.createdAt),
    };
  }

  // ───────────────────────── Pharmacy stock & dispensing ─────────────────────────

  async getMonthlyPharmacyReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const [dispensedRx, sales, medicines, purchasesInRange] = await Promise.all([
      this.prescriptionsRepo.find({
        where: { status: PrescriptionStatus.DISPENSED, dispensedAt: Between(r.start, r.endInclusive) },
        relations: ['medicine'],
      }),
      this.salesRepo.find({
        where: { createdAt: Between(r.start, r.endInclusive), status: Not(SaleStatus.VOIDED) },
        relations: ['items', 'items.medicine'],
      }),
      this.medicinesRepo.find(),
      // Only CONFIRMED purchases count as real restocking — PENDING hasn't
      // arrived yet and CANCELLED never did.
      this.purchasesRepo.find({
        where: [
          { status: PurchaseStatus.CONFIRMED, confirmedAt: Between(r.start, r.endInclusive) },
          { status: PurchaseStatus.CONFIRMED, confirmedAt: IsNull(), createdAt: Between(r.start, r.endInclusive) },
        ],
      }),
    ]);
    const round = (n: number) => Math.round(n * 100) / 100;

    const rxRevenue = dispensedRx.reduce((s, p) => {
      if (p.subtotal != null) return s + Number(p.subtotal);
      return s + Number(p.quantity ?? 0) * Number((p as any).medicine?.sellPrice ?? 0);
    }, 0);
    const rxQty = dispensedRx.reduce((s, p) => s + Number(p.quantity || 0), 0);

    let posQty = 0, posRevenue = 0, posCost = 0;
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        posQty += Number(item.quantity || 0);
        posRevenue += Number(item.subtotal || 0);
        posCost += Number(item.costPrice || 0) * Number(item.quantity || 0);
      }
    }

    const currentStockValue = medicines.reduce((s, m) => s + Number(m.stockQuantity || 0) * Number(m.costPrice || 0), 0);
    const lowStock = medicines.filter(m => m.stockQuantity <= m.reorderLevel);

    const medicinesById: Record<string, any> = {};
    for (const m of medicines) medicinesById[m.id] = m;

    // Restocked qty per medicine, from confirmed purchases in the period.
    const restockedByMedicine: Record<string, number> = {};
    for (const purchase of purchasesInRange) {
      for (const item of purchase.items ?? []) {
        restockedByMedicine[item.medicineId] = (restockedByMedicine[item.medicineId] || 0) + Number(item.quantity || 0);
      }
    }

    const byMedicineMap: Record<string, { medicineId: string; name: string; unit: string; dispensedQty: number; posQty: number; revenue: number }> = {};
    for (const p of dispensedRx) {
      const medId = p.medicineId || p.drugName;
      const name = (p as any).medicine?.name ?? p.drugName;
      const unit = (p as any).medicine?.unit ?? 'unit';
      const m = (byMedicineMap[medId] ??= { medicineId: medId, name, unit, dispensedQty: 0, posQty: 0, revenue: 0 });
      m.dispensedQty += Number(p.quantity || 0);
      m.revenue += p.subtotal != null ? Number(p.subtotal) : Number(p.quantity ?? 0) * Number((p as any).medicine?.sellPrice ?? 0);
    }
    for (const sale of sales) {
      for (const item of sale.items ?? []) {
        const medId = item.medicineId;
        const name = (item as any).medicine?.name ?? item.medicineId;
        const unit = (item as any).medicine?.unit ?? 'unit';
        const m = (byMedicineMap[medId] ??= { medicineId: medId, name, unit, dispensedQty: 0, posQty: 0, revenue: 0 });
        m.posQty += Number(item.quantity || 0);
        m.revenue += Number(item.subtotal || 0);
      }
    }

    // Medicines that were restocked but not sold/dispensed still belong in the table.
    for (const [medId, qty] of Object.entries(restockedByMedicine)) {
      if (qty > 0 && !byMedicineMap[medId]) {
        byMedicineMap[medId] = { medicineId: medId, name: medicinesById[medId]?.name ?? medId, unit: medicinesById[medId]?.unit ?? 'unit', dispensedQty: 0, posQty: 0, revenue: 0 };
      }
    }

    return {
      range: { from: r.from, to: r.to },
      totals: {
        rxDispensedCount: dispensedRx.length,
        rxDispensedQty: rxQty,
        rxRevenue: round(rxRevenue),
        posSalesCount: sales.length,
        posQty,
        posRevenue: round(posRevenue),
        posGrossProfit: round(posRevenue - posCost),
        totalRevenue: round(rxRevenue + posRevenue),
        currentStockValue: round(currentStockValue),
        lowStockCount: lowStock.length,
      },
      byMedicine: Object.values(byMedicineMap)
        .map(m => {
          const med = medicinesById[m.medicineId];
          const endingQty = med ? Number(med.stockQuantity || 0) : 0;
          const usedQty = m.dispensedQty + m.posQty;
          const restockedQty = restockedByMedicine[m.medicineId] || 0;
          const openingQty = endingQty - restockedQty + usedQty;
          return { ...m, revenue: round(m.revenue), restockedQty, usedQty, openingQty, endingQty };
        })
        .sort((a, b) => b.revenue - a.revenue),
      lowStock: lowStock.map(m => ({ name: m.name, stockQuantity: m.stockQuantity, reorderLevel: m.reorderLevel })),
      daily: this.dailySeries(r.days, dispensedRx, p => p.dispensedAt),
    };
  }

  // ───────────────────────── Inventory valuation & expiry ─────────────────────────

  async getMonthlyInventoryValuationReport(from?: string, to?: string) {
    const r = this.resolveDateRange(from, to);
    const [labSupplies, medicines] = await Promise.all([
      this.labSuppliesRepo.find(),
      this.medicinesRepo.find(),
    ]);
    const round = (n: number) => Math.round(n * 100) / 100;

    const soon = new Date(r.endInclusive);
    soon.setDate(soon.getDate() + 90);

    const labValue = labSupplies.reduce((s, x) => s + Number(x.stockQuantity || 0) * Number(x.costPrice || 0), 0);
    const medValue = medicines.reduce((s, x) => s + Number(x.stockQuantity || 0) * Number(x.costPrice || 0), 0);

    const nearExpiry = [
      ...labSupplies
        .filter(x => x.expiryDate && new Date(x.expiryDate) <= soon)
        .map(x => ({ name: x.name, type: 'lab_supply', expiryDate: x.expiryDate, stockQuantity: x.stockQuantity })),
      ...medicines
        .filter(x => x.expiryDate && new Date(x.expiryDate) <= soon)
        .map(x => ({ name: x.name, type: 'medicine', expiryDate: x.expiryDate, stockQuantity: x.stockQuantity })),
    ].sort((a, b) => new Date(a.expiryDate as any).getTime() - new Date(b.expiryDate as any).getTime());

    return {
      range: { from: r.from, to: r.to },
      totals: {
        labSuppliesValue: round(labValue),
        medicinesValue: round(medValue),
        totalValue: round(labValue + medValue),
        labSuppliesLowStock: labSupplies.filter(x => x.stockQuantity <= x.reorderLevel).length,
        medicinesLowStock: medicines.filter(x => x.stockQuantity <= x.reorderLevel).length,
        nearExpiryCount: nearExpiry.length,
      },
      byLabCategory: this.countBy(labSupplies, x => x.category),
      byMedicineCategory: this.countBy(medicines, x => x.category),
      nearExpiry,
    };
  }

}
