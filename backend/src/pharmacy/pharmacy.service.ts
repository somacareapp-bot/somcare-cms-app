import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
import { Purchase, PurchaseStatus, PurchaseApprovalStatus } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Sale, SaleStatus } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
import { SaleReturn, ReturnReason, ReturnType } from './entities/sale-return.entity';
import { Prescription, PrescriptionStatus } from '../visits/entities/prescription.entity';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { RestockMedicineDto } from './dto/restock-medicine.dto';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordPurchasePaymentDto } from './dto/record-purchase-payment.dto';
import { AdminReviewPurchaseDto, PurchaseReviewDecision } from './dto/admin-review-purchase.dto';
import { MarkPurchasePaidDto } from './dto/mark-purchase-paid.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { ApprovalRoutingService } from '../approvals/approval-routing.service';
import { DeptHeadReviewPurchaseDto, PurchaseDeptHeadDecision } from './dto/dept-head-review-purchase.dto';

const VAT_RATE = 0.05; // 5% — adjust here if your VAT rate differs

@Injectable()
export class PharmacyService {
  constructor(
    @InjectRepository(Medicine)
    private readonly medicinesRepo: Repository<Medicine>,
    @InjectRepository(Prescription)
    private readonly prescriptionsRepo: Repository<Prescription>,
    @InjectRepository(Purchase)
    private readonly purchasesRepo: Repository<Purchase>,
    @InjectRepository(PurchaseItem)
    private readonly purchaseItemsRepo: Repository<PurchaseItem>,
    @InjectRepository(Sale)
    private readonly salesRepo: Repository<Sale>,
    @InjectRepository(SaleItem)
    private readonly saleItemsRepo: Repository<SaleItem>,
    @InjectRepository(SaleReturn)
    private readonly saleReturnsRepo: Repository<SaleReturn>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly approvalRouting: ApprovalRoutingService,
  ) {}

  private async notifyRoles(roleNames: string[], opts: { actorName: string; actorAvatarUrl?: string; message: string; link?: string; meta?: Record<string, any>; type?: NotificationType }) {
    const targetRoles = Array.from(new Set([...roleNames, 'administrator']));
    const users = await this.usersService.findByRoleNames(targetRoles);
    await Promise.all(
      users.map((u) =>
        this.notificationsService.create({
          recipientId: u.id,
          actorName: opts.actorName,
          actorAvatarUrl: opts.actorAvatarUrl,
          type: opts.type ?? NotificationType.PRESCRIPTION,
          message: opts.message,
          link: opts.link,
          meta: opts.meta,
        }),
      ),
    );
  }

  private async notifyUser(recipientId: string, opts: { actorName: string; actorAvatarUrl?: string; message: string; link?: string; meta?: Record<string, any>; type?: NotificationType }) {
    await this.notificationsService.create({
      recipientId,
      actorName: opts.actorName,
      actorAvatarUrl: opts.actorAvatarUrl,
      type: opts.type ?? NotificationType.PRESCRIPTION,
      message: opts.message,
      link: opts.link,
      meta: opts.meta,
    });
  }

  // Returns the department-head user id for a given submitter, or null if the
  // submitter has no department, or that department has no head assigned.
  // Now follows the shared chain of command (org chart + departments), not just the department row.
  private async findDeptHeadId(submittedById: string): Promise<string | null> {
    return this.approvalRouting.resolveApproverId(submittedById);
  }

  // ----- Medicines -----
  async findAllMedicines(search?: string) {
    const qb = this.medicinesRepo.createQueryBuilder('m').where('m.isActive = true');
    if (search) {
      qb.andWhere('(m.name ILIKE :s OR m.genericName ILIKE :s)', { s: `%${search}%` });
    }
    return qb.orderBy('m.name', 'ASC').getMany();
  }

  findLowStock() {
    return this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.isActive = true')
      .andWhere('m.stockQuantity <= m.reorderLevel')
      .orderBy('m.stockQuantity', 'ASC')
      .getMany();
  }

  async findOneMedicine(id: string): Promise<Medicine> {
    const medicine = await this.medicinesRepo.findOne({ where: { id } });
    if (!medicine) throw new NotFoundException('Medicine not found');
    return medicine;
  }

  createMedicine(dto: CreateMedicineDto) {
    const medicine = this.medicinesRepo.create(dto);
    return this.medicinesRepo.save(medicine);
  }

  async updateMedicine(id: string, dto: UpdateMedicineDto) {
    const medicine = await this.findOneMedicine(id);
    Object.assign(medicine, dto);
    return this.medicinesRepo.save(medicine);
  }

  async deactivateMedicine(id: string) {
    const medicine = await this.findOneMedicine(id);
    medicine.isActive = false;
    return this.medicinesRepo.save(medicine);
  }

  async restockMedicine(id: string, dto: RestockMedicineDto) {
    const medicine = await this.findOneMedicine(id);
    medicine.stockQuantity += dto.quantity;
    return this.medicinesRepo.save(medicine);
  }

  // ----- Prescriptions -----
  findPrescriptions(status?: PrescriptionStatus) {
    return this.prescriptionsRepo.find({
      where: status ? { status } : {},
      relations: ['visit', 'visit.patient', 'medicine'],
      order: { createdAt: 'DESC' },
    });
  }

  async dispense(id: string, dto: DispensePrescriptionDto, dispensedByName?: string, dispensedByAvatar?: string): Promise<Prescription> {
    const prescription = await this.prescriptionsRepo.findOne({ where: { id }, relations: ['medicine', 'visit', 'visit.doctor'] });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.status === PrescriptionStatus.DISPENSED) {
      throw new BadRequestException('Prescription already dispensed');
    }

    const medicine = await this.findOneMedicine(dto.medicineId);
    if (medicine.stockQuantity < dto.quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${medicine.stockQuantity} ${medicine.unit}(s) available.`,
      );
    }

    medicine.stockQuantity -= dto.quantity;
    await this.medicinesRepo.save(medicine);

    const unitPrice = Number(medicine.sellPrice);
    prescription.medicineId = medicine.id;
    prescription.quantity = dto.quantity;
    prescription.status = PrescriptionStatus.DISPENSED;
    prescription.dispensedAt = new Date();
    prescription.unitPrice = unitPrice;
    prescription.subtotal = Math.round(unitPrice * dto.quantity * 100) / 100;
    if (dispensedByName) prescription.dispensedByName = dispensedByName;
    const saved = await this.prescriptionsRepo.save(prescription);

    const pharmacistName = dispensedByName ?? 'Pharmacy';
    const doctor = prescription.visit?.doctor;
    const message = `${pharmacistName} dispensed ${prescription.drugName} for the prescription you sent`;
    const link = '/queue/current';
    if (doctor) {
      await this.notifyUser(doctor.id, {
        actorName: pharmacistName,
        actorAvatarUrl: dispensedByAvatar,
        message,
        link,
        meta: { prescriptionId: saved.id, visitId: prescription.visitId },
      });
    }
    await this.notifyRoles([], {
      actorName: pharmacistName,
      actorAvatarUrl: dispensedByAvatar,
      message,
      link,
      meta: { prescriptionId: saved.id, visitId: prescription.visitId },
    });

    return saved;
  }

  async cancelPrescription(id: string) {
    const prescription = await this.prescriptionsRepo.findOne({ where: { id } });
    if (!prescription) throw new NotFoundException('Prescription not found');
    prescription.status = PrescriptionStatus.CANCELLED;
    return this.prescriptionsRepo.save(prescription);
  }

  // ----- Purchases (goods-receipt + payment tracking + approval workflow) -----
  private async generatePurchaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.purchasesRepo.count({ where: { purchaseNumber: ILike(`PO-${year}-%`) } });
    return `PO-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  async createPurchase(dto: CreatePurchaseDto, submittedById?: string, submittedByName?: string, submittedByAvatar?: string): Promise<Purchase> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Purchase must include at least one item');
    }
    for (const item of dto.items) {
      await this.findOneMedicine(item.medicineId);
    }

    const items = dto.items.map((item) =>
      this.purchaseItemsRepo.create({
        medicineId: item.medicineId,
        quantity: item.quantity,
        costPrice: item.costPrice,
        subtotal: item.quantity * item.costPrice,
      }),
    );
    const totalAmount = items.reduce((sum, i) => sum + Number(i.subtotal), 0);

    // Department-head stage: route to the submitter's department head, or
    // auto-skip straight to admin review when there is no head to route to.
    const deptHeadId = submittedById ? await this.findDeptHeadId(submittedById) : null;

    const purchase = this.purchasesRepo.create({
      purchaseNumber: await this.generatePurchaseNumber(),
      supplierName: dto.supplierName,
      invoiceNumber: dto.invoiceNumber,
      attachmentUrl: dto.attachmentUrl,
      totalAmount,
      items,
      approvalStatus: deptHeadId
        ? PurchaseApprovalStatus.SUBMITTED
        : PurchaseApprovalStatus.DEPT_HEAD_APPROVED,
      deptHeadAutoSkipped: !deptHeadId,
      submittedById,
      submittedByName,
    });
    const saved = await this.purchasesRepo.save(purchase);

    if (submittedByName) {
      if (deptHeadId) {
        await this.notifyUser(deptHeadId, {
          actorName: submittedByName,
          actorAvatarUrl: submittedByAvatar,
          message: `${submittedByName} submitted a purchase order for your approval: ${saved.purchaseNumber}`,
          link: '/pharmacy/purchases',
          meta: { purchaseId: saved.id },
          type: NotificationType.PURCHASE,
        });
      } else {
        await this.notifyRoles([], {
          actorName: submittedByName,
          actorAvatarUrl: submittedByAvatar,
          message: `${submittedByName} submitted a purchase order: ${saved.purchaseNumber} — awaiting approval`,
          link: '/pharmacy/purchases',
          meta: { purchaseId: saved.id },
          type: NotificationType.PURCHASE,
        });
      }
    }

    return this.withPaymentInfo(saved);
  }

  private async getPurchaseEntity(id: string): Promise<Purchase> {
    const purchase = await this.purchasesRepo.findOne({ where: { id }, relations: ['items', 'items.medicine'] });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  private withPaymentInfo(purchase: Purchase) {
    const totalAmount = Number(purchase.totalAmount);
    const paidAmount = Number(purchase.paidAmount);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = paidAmount <= 0 ? 'unpaid' : dueAmount <= 0 ? 'paid' : 'partial';
    return { ...purchase, totalAmount, paidAmount, dueAmount, paymentStatus };
  }

  async findAllPurchases(status?: PurchaseStatus, approvalStatus?: PurchaseApprovalStatus) {
    const where: any = {};
    if (status) where.status = status;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    const purchases = await this.purchasesRepo.find({
      where,
      relations: ['items', 'items.medicine'],
      order: { createdAt: 'DESC' },
    });
    return purchases.map((p) => this.withPaymentInfo(p));
  }

  async findOnePurchase(id: string) {
    return this.withPaymentInfo(await this.getPurchaseEntity(id));
  }

  async recordPayment(id: string, dto: RecordPurchasePaymentDto) {
    const purchase = await this.getPurchaseEntity(id);
    const totalAmount = Number(purchase.totalAmount);
    const currentPaid = Number(purchase.paidAmount);
    const newPaid = currentPaid + dto.amount;
    if (newPaid > totalAmount + 0.01) {
      throw new BadRequestException(
        `Payment exceeds the amount due. Remaining due: $${(totalAmount - currentPaid).toFixed(2)}`,
      );
    }
    purchase.paidAmount = newPaid;
    const saved = await this.purchasesRepo.save(purchase);
    return this.withPaymentInfo(saved);
  }

  async confirmPurchase(id: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }

    for (const item of purchase.items) {
      const medicine = await this.findOneMedicine(item.medicineId);
      medicine.stockQuantity += item.quantity;
      medicine.costPrice = item.costPrice;
      await this.medicinesRepo.save(medicine);
    }

    purchase.status = PurchaseStatus.CONFIRMED;
    purchase.confirmedAt = new Date();
    const saved = await this.purchasesRepo.save(purchase);

    if (purchase.submittedById) {
      await this.notifyUser(purchase.submittedById, {
        actorName: 'Pharmacy',
        message: `Purchase order ${purchase.purchaseNumber} was confirmed and stock received`,
        link: '/pharmacy/purchases',
        meta: { purchaseId: saved.id },
        type: NotificationType.PURCHASE,
      });
    }

    return this.withPaymentInfo(saved);
  }

  async cancelPurchase(id: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }
    purchase.status = PurchaseStatus.CANCELLED;
    const saved = await this.purchasesRepo.save(purchase);

    if (purchase.submittedById) {
      await this.notifyUser(purchase.submittedById, {
        actorName: 'Pharmacy',
        message: `Purchase order ${purchase.purchaseNumber} was cancelled`,
        link: '/pharmacy/purchases',
        meta: { purchaseId: saved.id },
        type: NotificationType.PURCHASE,
      });
    }

    return this.withPaymentInfo(saved);
  }

  // Stage 1.5: Department head approves or rejects a freshly-submitted purchase.
  // Administrators can act on behalf of any department head (override).
  async deptHeadReviewPurchase(id: string, dto: DeptHeadReviewPurchaseDto, userId: string, userName: string, userAvatar: string | undefined, isAdmin: boolean) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== PurchaseApprovalStatus.SUBMITTED) {
      throw new BadRequestException('Purchase is not awaiting department head review');
    }

    if (!isAdmin) {
      const deptHeadId = purchase.submittedById ? await this.findDeptHeadId(purchase.submittedById) : null;
      if (!deptHeadId || deptHeadId !== userId) {
        throw new ForbiddenException('You are not the department head for this submitter');
      }
    }

    const approved = dto.decision === PurchaseDeptHeadDecision.APPROVE;
    purchase.approvalStatus = approved
      ? PurchaseApprovalStatus.ADMIN_APPROVED
      : PurchaseApprovalStatus.DEPT_HEAD_REJECTED;
    purchase.deptHeadApprovedById = userId;
    purchase.deptHeadApprovedByName = userName;
    purchase.deptHeadApprovedAt = new Date();
    purchase.deptHeadNotes = dto.notes ?? '';
    purchase.deptHeadAutoSkipped = false;
    if (approved) {
      purchase.reviewedById = userId;
      purchase.reviewedByName = userName;
      purchase.reviewedAt = new Date();
    }
    // Also surface the reason where the existing UI already looks for it.
    if (!approved) purchase.rejectionReason = dto.notes ?? '';
    const saved = await this.purchasesRepo.save(purchase);

    if (approved) {
      await this.notifyRoles(['accountant'], {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} approved purchase order ${purchase.purchaseNumber} — ready for payment`,
        link: '/pharmacy/purchases',
        meta: { purchaseId: saved.id },
        type: NotificationType.PURCHASE,
      });
    } else if (purchase.submittedById) {
      await this.notifyUser(purchase.submittedById, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} rejected purchase order ${purchase.purchaseNumber}`,
        link: '/pharmacy/purchases',
        meta: { purchaseId: saved.id },
        type: NotificationType.PURCHASE,
      });
    }

    return this.withPaymentInfo(saved);
  }

  // Stage 2: Administrator approves or rejects a submitted purchase
  async adminReviewPurchase(id: string, dto: AdminReviewPurchaseDto, userId: string, userName: string, userAvatar?: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== PurchaseApprovalStatus.DEPT_HEAD_APPROVED) {
      throw new BadRequestException('Purchase is not awaiting admin review');
    }
    purchase.approvalStatus =
      dto.decision === PurchaseReviewDecision.APPROVE
        ? PurchaseApprovalStatus.ADMIN_APPROVED
        : PurchaseApprovalStatus.ADMIN_REJECTED;
    purchase.reviewedById = userId;
    purchase.reviewedByName = userName;
    purchase.reviewedAt = new Date();
    if (dto.decision === PurchaseReviewDecision.REJECT) {
      purchase.rejectionReason = dto.notes ?? '';
    }
    const saved = await this.purchasesRepo.save(purchase);

    if (purchase.submittedById) {
      const verb = dto.decision === PurchaseReviewDecision.APPROVE ? 'approved' : 'rejected';
      await this.notifyUser(purchase.submittedById, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} ${verb} purchase order ${purchase.purchaseNumber}`,
        link: '/pharmacy/purchases',
        meta: { purchaseId: saved.id },
        type: NotificationType.PURCHASE,
      });
    }

    return this.withPaymentInfo(saved);
  }

  // Stage 3: Accountant closes out an admin-approved purchase once balance is $0
  async markPurchasePaid(id: string, dto: MarkPurchasePaidDto, userId: string, userName: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== PurchaseApprovalStatus.ADMIN_APPROVED) {
      throw new BadRequestException('Purchase must be admin-approved before it can be marked as paid');
    }
    const dueAmount = Math.max(0, Number(purchase.totalAmount) - Number(purchase.paidAmount));
    if (dueAmount > 0.01) {
      throw new BadRequestException(
        `Cannot mark as paid — outstanding balance of $${dueAmount.toFixed(2)} remains`,
      );
    }
    purchase.approvalStatus = PurchaseApprovalStatus.PAID;
    purchase.paidById = userId;
    purchase.paidByName = userName;
    purchase.paidAt = new Date();
    const saved = await this.purchasesRepo.save(purchase);
    return this.withPaymentInfo(saved);
  }

  // True when the user is linked to an org chart box or heads a department (drives the review tab).
  async isApprover(userId: string) {
    return this.approvalRouting.isApprover(userId);
  }

  // Purchases waiting on THIS user as department head.
  async findAwaitingDeptHeadReview(userId: string, isAdmin: boolean) {
    if (isAdmin) {
      const purchases = await this.purchasesRepo.find({
        where: { approvalStatus: PurchaseApprovalStatus.SUBMITTED },
        relations: ['items', 'items.medicine'],
        order: { createdAt: 'DESC' },
      });
      return purchases.map((p) => this.withPaymentInfo(p));
    }
    const submitted = await this.purchasesRepo.find({
      where: { approvalStatus: PurchaseApprovalStatus.SUBMITTED },
      relations: ['items', 'items.medicine'],
      order: { createdAt: 'DESC' },
    });
    const mine: typeof submitted = [];
    for (const p of submitted) {
      if (p.submittedById && (await this.findDeptHeadId(p.submittedById)) === userId) mine.push(p);
    }
    return mine.map((p) => this.withPaymentInfo(p));
  }

  // ----- POS / Sales -----
  private async generateSaleNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.salesRepo.count({ where: { saleNumber: ILike(`POS-${year}-%`) } });
    return `POS-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  // changeAmount is derived, not stored — paidAmount vs totalAmount decides it
  private withSaleInfo(sale: Sale) {
    const totalAmount = Number(sale.totalAmount);
    const paidAmount = Number(sale.paidAmount);
    const changeAmount = Math.max(0, paidAmount - totalAmount);
    return { ...sale, totalAmount, paidAmount, changeAmount };
  }

  async createSale(dto: CreateSaleDto, cashierName?: string): Promise<any> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Sale must include at least one item');
    }

    const medicines = new Map<string, Medicine>();
    for (const item of dto.items) {
      const medicine = await this.findOneMedicine(item.medicineId);
      if (medicine.stockQuantity < item.quantity) {
        throw new BadRequestException(
          `Insufficient stock for ${medicine.name}. Only ${medicine.stockQuantity} ${medicine.unit}(s) available.`,
        );
      }
      medicines.set(item.medicineId, medicine);
    }

    const saleItems: SaleItem[] = [];
    let subtotalAmount = 0;

    for (const item of dto.items) {
      const medicine = medicines.get(item.medicineId)!;
      const lineSubtotal = Number(medicine.sellPrice) * item.quantity;
      subtotalAmount += lineSubtotal;

      medicine.stockQuantity -= item.quantity;
      await this.medicinesRepo.save(medicine);

      saleItems.push(
        this.saleItemsRepo.create({
          medicineId: medicine.id,
          quantity: item.quantity,
          unitPrice: medicine.sellPrice,
          costPrice: medicine.costPrice,
          subtotal: lineSubtotal,
        }),
      );
    }

    const discountAmount = Math.min(dto.discountAmount ?? 0, subtotalAmount);
    const taxableAmount = subtotalAmount - discountAmount;
    const taxAmount = Math.round(taxableAmount * VAT_RATE * 100) / 100;
    const totalAmount = taxableAmount + taxAmount;
    const paidAmount = dto.paidAmount ?? totalAmount;

    if (paidAmount < totalAmount - 0.01) {
      throw new BadRequestException(
        `Amount paid ($${paidAmount.toFixed(2)}) is less than the total due ($${totalAmount.toFixed(2)})`,
      );
    }

    const sale = this.salesRepo.create({
      saleNumber: await this.generateSaleNumber(),
      patientId: dto.patientId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerAddress: dto.customerAddress,
      subtotalAmount,
      discountAmount,
      taxAmount,
      totalAmount,
      paidAmount,
      paymentMethod: dto.paymentMethod,
      cashierName: cashierName ?? dto.cashierName,
      notes: dto.notes,
      items: saleItems,
    });
    const saved = await this.salesRepo.save(sale);
    const full = await this.salesRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.medicine'],
    });
    return this.withSaleInfo(full!);
  }

  async findSales() {
    const sales = await this.salesRepo.find({ relations: ['items', 'items.medicine'], order: { createdAt: 'DESC' } });
    return sales.map((s) => this.withSaleInfo(s));
  }

  async findOneSale(id: string) {
    const sale = await this.salesRepo.findOne({ where: { id }, relations: ['items', 'items.medicine'] });
    if (!sale) throw new NotFoundException('Sale not found');
    return this.withSaleInfo(sale);
  }

  async voidSale(id: string) {
    const sale = await this.salesRepo.findOne({ where: { id }, relations: ['items', 'items.medicine'] });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status === SaleStatus.VOIDED) throw new BadRequestException('Sale already voided');

    for (const item of sale.items) {
      const medicine = await this.findOneMedicine(item.medicineId);
      medicine.stockQuantity += item.quantity;
      await this.medicinesRepo.save(medicine);
    }

    sale.status = SaleStatus.VOIDED;
    const saved = await this.salesRepo.save(sale);
    const full = await this.salesRepo.findOne({
      where: { id: saved.id },
      relations: ['items', 'items.medicine'],
    });
    return this.withSaleInfo(full!);
  }

  // ----- Dashboard -----
  async getDashboardStats() {
    const [pendingCount, dispensedToday, lowStock, totalMedicines] = await Promise.all([
      this.prescriptionsRepo.count({ where: { status: PrescriptionStatus.PENDING } }),
      this.prescriptionsRepo
        .createQueryBuilder('p')
        .where('p.status = :status', { status: PrescriptionStatus.DISPENSED })
        .andWhere('p.dispensedAt >= :today', { today: new Date(new Date().setHours(0, 0, 0, 0)) })
        .getCount(),
      this.findLowStock(),
      this.medicinesRepo.count({ where: { isActive: true } }),
    ]);

    return {
      pendingCount,
      dispensedToday,
      lowStockCount: lowStock.length,
      totalMedicines,
      lowStockItems: lowStock.slice(0, 5),
    };
  }
  // ----- Returns -----
  private async generateReturnNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.saleReturnsRepo.count();
    return `RET-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  async createReturn(dto: {
    type: ReturnType;
    saleId?: string;
    saleItemId?: string;
    prescriptionId?: string;
    quantity: number;
    reason: ReturnReason;
    notes?: string;
    processedBy?: string;
  }): Promise<SaleReturn> {
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Return quantity must be greater than zero');
    }

    if (dto.type === ReturnType.POS) {
      if (!dto.saleId || !dto.saleItemId) {
        throw new BadRequestException('saleId and saleItemId are required for a POS return');
      }
      const sale = await this.salesRepo.findOne({ where: { id: dto.saleId }, relations: ['items', 'items.medicine'] });
      if (!sale) throw new NotFoundException('Sale not found');
      if (sale.status === SaleStatus.VOIDED) throw new BadRequestException('Cannot return a voided sale');

      const saleItem = sale.items.find((i) => i.id === dto.saleItemId);
      if (!saleItem) throw new NotFoundException('Sale item not found on this sale');

      const { sum } = await this.saleReturnsRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.quantity), 0)', 'sum')
        .where('r.sale_item_id = :id', { id: dto.saleItemId })
        .getRawOne();
      const alreadyReturned = Number(sum);
      const maxReturnable = saleItem.quantity - alreadyReturned;
      if (dto.quantity > maxReturnable) {
        throw new BadRequestException(`Cannot return more than ${maxReturnable} remaining unit(s) for this item`);
      }

      const medicine = await this.findOneMedicine(saleItem.medicineId);
      medicine.stockQuantity += dto.quantity;
      await this.medicinesRepo.save(medicine);

      const refundAmount = dto.quantity * Number(saleItem.unitPrice);
      const ret = this.saleReturnsRepo.create({
        returnNumber: await this.generateReturnNumber(),
        type: ReturnType.POS,
        saleId: sale.id,
        saleItemId: saleItem.id,
        medicineId: saleItem.medicineId,
        quantity: dto.quantity,
        unitPrice: saleItem.unitPrice,
        refundAmount,
        reason: dto.reason,
        notes: dto.notes,
        processedBy: dto.processedBy,
      });
      return this.saleReturnsRepo.save(ret);
    }

    if (dto.type === ReturnType.RX) {
      if (!dto.prescriptionId) {
        throw new BadRequestException('prescriptionId is required for an RX return');
      }
      const prescription = await this.prescriptionsRepo.findOne({ where: { id: dto.prescriptionId }, relations: ['medicine'] });
      if (!prescription) throw new NotFoundException('Prescription not found');
      if (prescription.status !== PrescriptionStatus.DISPENSED) {
        throw new BadRequestException('Only dispensed prescriptions can be returned');
      }

      const { sum } = await this.saleReturnsRepo
        .createQueryBuilder('r')
        .select('COALESCE(SUM(r.quantity), 0)', 'sum')
        .where('r.prescription_id = :id', { id: dto.prescriptionId })
        .getRawOne();
      const alreadyReturned = Number(sum);
      const maxReturnable = (prescription.quantity ?? 0) - alreadyReturned;
      if (dto.quantity > maxReturnable) {
        throw new BadRequestException(`Cannot return more than ${maxReturnable} remaining unit(s) for this prescription`);
      }
      if (!prescription.medicineId) {
        throw new BadRequestException('This prescription has no linked medicine to restock');
      }

      const medicine = await this.findOneMedicine(prescription.medicineId);
      medicine.stockQuantity += dto.quantity;
      await this.medicinesRepo.save(medicine);

      const unitPrice = Number(medicine.sellPrice ?? 0);
      const refundAmount = dto.quantity * unitPrice;
      const ret = this.saleReturnsRepo.create({
        returnNumber: await this.generateReturnNumber(),
        type: ReturnType.RX,
        prescriptionId: prescription.id,
        medicineId: medicine.id,
        quantity: dto.quantity,
        unitPrice,
        refundAmount,
        reason: dto.reason,
        notes: dto.notes,
        processedBy: dto.processedBy,
      });
      return this.saleReturnsRepo.save(ret);
    }

    throw new BadRequestException('Unknown return type');
  }

  async findAllReturns(): Promise<SaleReturn[]> {
    return this.saleReturnsRepo.find({ order: { createdAt: 'DESC' } });
  }

}
