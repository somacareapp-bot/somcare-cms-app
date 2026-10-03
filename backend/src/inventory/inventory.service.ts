import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { LabSupply } from './entities/lab-supply.entity';
import { LabSupplyPurchase, LabSupplyPurchaseStatus, LabSupplyPurchaseApprovalStatus } from './entities/lab-supply-purchase.entity';
import { LabSupplyPurchaseItem } from './entities/lab-supply-purchase-item.entity';
import { LabSupplyStockLog, LabSupplyStockLogType, LabSupplyStockLogReferenceType } from './entities/lab-supply-stock-log.entity';
import { CreateLabSupplyDto } from './dto/create-lab-supply.dto';
import { UpdateLabSupplyDto } from './dto/update-lab-supply.dto';
import { RestockLabSupplyDto } from './dto/restock-lab-supply.dto';
import { IssueLabSupplyDto } from './dto/issue-lab-supply.dto';
import { CreateLabSupplyPurchaseDto } from './dto/create-lab-supply-purchase.dto';
import { RecordLabSupplyPurchasePaymentDto } from './dto/record-lab-supply-purchase-payment.dto';
import { AdminReviewLabSupplyPurchaseDto, LabSupplyPurchaseReviewDecision } from './dto/admin-review-lab-supply-purchase.dto';
import { MarkLabSupplyPurchasePaidDto } from './dto/mark-lab-supply-purchase-paid.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { ApprovalRoutingService } from '../approvals/approval-routing.service';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
import { DeptHeadReviewLabSupplyPurchaseDto, LabSupplyDeptHeadDecision } from './dto/dept-head-review-lab-supply-purchase.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(LabSupply) private readonly labSuppliesRepo: Repository<LabSupply>,
    @InjectRepository(LabSupplyPurchase) private readonly purchasesRepo: Repository<LabSupplyPurchase>,
    @InjectRepository(LabSupplyPurchaseItem) private readonly purchaseItemsRepo: Repository<LabSupplyPurchaseItem>,
    @InjectRepository(LabSupplyStockLog) private readonly stockLogsRepo: Repository<LabSupplyStockLog>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly approvalRouting: ApprovalRoutingService,
  ) {}

  private async notifyRoles(roleNames: string[], opts: { actorName: string; actorAvatarUrl?: string; message: string; link?: string; meta?: Record<string, any> }) {
    const targetRoles = Array.from(new Set([...roleNames, 'administrator']));
    const users = await this.usersService.findByRoleNames(targetRoles);
    await Promise.all(
      users.map((u) =>
        this.notificationsService.create({
          recipientId: u.id,
          actorName: opts.actorName,
          actorAvatarUrl: opts.actorAvatarUrl,
          type: NotificationType.PURCHASE,
          message: opts.message,
          link: opts.link,
          meta: opts.meta,
        }),
      ),
    );
  }

  private async notifyUser(recipientId: string, opts: { actorName: string; actorAvatarUrl?: string; message: string; link?: string; meta?: Record<string, any> }) {
    await this.notificationsService.create({
      recipientId,
      actorName: opts.actorName,
      actorAvatarUrl: opts.actorAvatarUrl,
      type: NotificationType.PURCHASE,
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

  // ----- Lab Supplies (catalog) -----
  async findAllSupplies(search?: string) {
    return this.labSuppliesRepo.find({
      where: search ? { name: ILike(`%${search}%`) } : {},
      order: { name: 'ASC' },
    });
  }

  async findLowStock() {
    const all = await this.labSuppliesRepo.find({ where: { isActive: true } });
    return all.filter((s) => s.stockQuantity <= s.reorderLevel);
  }

  async findOneSupply(id: string): Promise<LabSupply> {
    const supply = await this.labSuppliesRepo.findOne({ where: { id } });
    if (!supply) throw new NotFoundException('Lab supply not found');
    return supply;
  }

  async createSupply(dto: CreateLabSupplyDto) {
    const supply = this.labSuppliesRepo.create(dto as any);
    return this.labSuppliesRepo.save(supply);
  }

  async updateSupply(id: string, dto: UpdateLabSupplyDto) {
    const supply = await this.findOneSupply(id);
    Object.assign(supply, dto);
    return this.labSuppliesRepo.save(supply);
  }

  async restockSupply(id: string, dto: RestockLabSupplyDto, userId?: string) {
    const supply = await this.findOneSupply(id);
    const previousStock = supply.stockQuantity;
    supply.stockQuantity += dto.quantity;
    const saved = await this.labSuppliesRepo.save(supply);

    const unitCost = Number(dto.unitCost ?? supply.costPrice ?? 0);

    await this.stockLogsRepo.save(
      this.stockLogsRepo.create({
        labSupplyId: id,
        type: LabSupplyStockLogType.RESTOCK,
        quantity: dto.quantity,
        previousStock,
        newStock: saved.stockQuantity,
        reason: dto.reason,
        referenceType: LabSupplyStockLogReferenceType.MANUAL,
        unitCost,
        totalCost: roundMoney(unitCost * dto.quantity),
        createdBy: userId,
      }),
    );

    return saved;
  }

  async issueSupply(id: string, dto: IssueLabSupplyDto, userId?: string) {
    const supply = await this.findOneSupply(id);
    const previousStock = supply.stockQuantity;

    if (dto.quantity > previousStock) {
      throw new BadRequestException(
        `Insufficient stock: requested ${dto.quantity}, available ${previousStock}`,
      );
    }

    supply.stockQuantity -= dto.quantity;
    const saved = await this.labSuppliesRepo.save(supply);

    const unitCost = Number(supply.costPrice ?? 0);

    await this.stockLogsRepo.save(
      this.stockLogsRepo.create({
        labSupplyId: id,
        type: LabSupplyStockLogType.ISSUE,
        quantity: dto.quantity,
        previousStock,
        newStock: saved.stockQuantity,
        reason: dto.reason,
        referenceType: LabSupplyStockLogReferenceType.MANUAL,
        unitCost,
        totalCost: roundMoney(unitCost * dto.quantity),
        createdBy: userId,
      }),
    );

    return saved;
  }

  async findStockLogs(id: string) {
    await this.findOneSupply(id);
    return this.stockLogsRepo.find({
      where: { labSupplyId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async deactivateSupply(id: string) {
    const supply = await this.findOneSupply(id);
    supply.isActive = false;
    return this.labSuppliesRepo.save(supply);
  }

  // ----- Purchases (goods receipt + payment tracking + approval workflow) -----
  private async generatePurchaseNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.purchasesRepo.count({ where: { purchaseNumber: ILike(`LSPO-${year}-%`) } });
    return `LSPO-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  async createPurchase(dto: CreateLabSupplyPurchaseDto, submittedById?: string, submittedByName?: string, submittedByAvatar?: string): Promise<any> {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Purchase must include at least one item');
    }
    for (const item of dto.items) {
      await this.findOneSupply(item.labSupplyId);
    }

    const items = dto.items.map((item) =>
      this.purchaseItemsRepo.create({
        labSupplyId: item.labSupplyId,
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
      paidAmount: dto.paidAmount ?? 0,
      items,
      approvalStatus: deptHeadId
        ? LabSupplyPurchaseApprovalStatus.SUBMITTED
        : LabSupplyPurchaseApprovalStatus.DEPT_HEAD_APPROVED,
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
          message: `${submittedByName} submitted a lab supply purchase order for your approval: ${saved.purchaseNumber}`,
          link: '/inventory/lab-supplies/purchases',
          meta: { purchaseId: saved.id },
        });
      } else {
        await this.notifyRoles([], {
          actorName: submittedByName,
          actorAvatarUrl: submittedByAvatar,
          message: `${submittedByName} submitted a lab supply purchase order: ${saved.purchaseNumber} — awaiting approval`,
          link: '/inventory/lab-supplies/purchases',
          meta: { purchaseId: saved.id },
        });
      }
    }

    return this.withPaymentInfo(saved);
  }

  private async getPurchaseEntity(id: string): Promise<LabSupplyPurchase> {
    const purchase = await this.purchasesRepo.findOne({ where: { id }, relations: ['items', 'items.labSupply'] });
    if (!purchase) throw new NotFoundException('Purchase not found');
    return purchase;
  }

  private withPaymentInfo(purchase: LabSupplyPurchase) {
    const totalAmount = Number(purchase.totalAmount);
    const paidAmount = Number(purchase.paidAmount);
    const dueAmount = Math.max(0, totalAmount - paidAmount);
    const paymentStatus = paidAmount <= 0 ? 'unpaid' : dueAmount <= 0 ? 'paid' : 'partial';
    return { ...purchase, totalAmount, paidAmount, dueAmount, paymentStatus };
  }

  async findAllPurchases(status?: LabSupplyPurchaseStatus, approvalStatus?: LabSupplyPurchaseApprovalStatus) {
    const where: any = {};
    if (status) where.status = status;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    const purchases = await this.purchasesRepo.find({
      where,
      relations: ['items', 'items.labSupply'],
      order: { createdAt: 'DESC' },
    });
    return purchases.map((p) => this.withPaymentInfo(p));
  }

  async findOnePurchase(id: string) {
    return this.withPaymentInfo(await this.getPurchaseEntity(id));
  }

  async recordPayment(id: string, dto: RecordLabSupplyPurchasePaymentDto) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status === LabSupplyPurchaseStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment on a cancelled purchase');
    }
    const totalAmount = Number(purchase.totalAmount);
    const newPaid = Number(purchase.paidAmount) + Number(dto.amount);
    if (newPaid > totalAmount) {
      throw new BadRequestException('Payment exceeds the outstanding balance');
    }
    purchase.paidAmount = newPaid;
    const saved = await this.purchasesRepo.save(purchase);
    return this.withPaymentInfo(saved);
  }

  async confirmPurchase(id: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status !== LabSupplyPurchaseStatus.PENDING) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }

    for (const item of purchase.items) {
      const supply = await this.findOneSupply(item.labSupplyId);
      supply.stockQuantity += item.quantity;
      supply.costPrice = item.costPrice;
      await this.labSuppliesRepo.save(supply);
    }

    purchase.status = LabSupplyPurchaseStatus.CONFIRMED;
    purchase.confirmedAt = new Date();
    const saved = await this.purchasesRepo.save(purchase);

    if (purchase.submittedById) {
      await this.notifyUser(purchase.submittedById, {
        actorName: 'Inventory',
        message: `Lab supply purchase order ${purchase.purchaseNumber} was confirmed and stock received`,
        link: '/inventory/lab-supplies/purchases',
        meta: { purchaseId: saved.id },
      });
    }

    return this.withPaymentInfo(saved);
  }

  async cancelPurchase(id: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status !== LabSupplyPurchaseStatus.PENDING) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }
    purchase.status = LabSupplyPurchaseStatus.CANCELLED;
    const saved = await this.purchasesRepo.save(purchase);

    if (purchase.submittedById) {
      await this.notifyUser(purchase.submittedById, {
        actorName: 'Inventory',
        message: `Lab supply purchase order ${purchase.purchaseNumber} was cancelled`,
        link: '/inventory/lab-supplies/purchases',
        meta: { purchaseId: saved.id },
      });
    }

    return this.withPaymentInfo(saved);
  }

  // Stage 1.5: Department head approves or rejects a freshly-submitted purchase.
  // Administrators can act on behalf of any department head (override).
  async deptHeadReviewPurchase(id: string, dto: DeptHeadReviewLabSupplyPurchaseDto, userId: string, userName: string, userAvatar: string | undefined, isAdmin: boolean) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== LabSupplyPurchaseApprovalStatus.SUBMITTED) {
      throw new BadRequestException('Purchase is not awaiting department head review');
    }

    if (!isAdmin) {
      const deptHeadId = purchase.submittedById ? await this.findDeptHeadId(purchase.submittedById) : null;
      if (!deptHeadId || deptHeadId !== userId) {
        throw new ForbiddenException('You are not the department head for this submitter');
      }
    }

    const approved = dto.decision === LabSupplyDeptHeadDecision.APPROVE;
    purchase.approvalStatus = approved
      ? LabSupplyPurchaseApprovalStatus.ADMIN_APPROVED
      : LabSupplyPurchaseApprovalStatus.DEPT_HEAD_REJECTED;
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
        message: `${userName} approved lab supply purchase order ${purchase.purchaseNumber} — ready for payment`,
        link: '/inventory/lab-supplies/purchases',
        meta: { purchaseId: saved.id },
      });
    } else if (purchase.submittedById) {
      await this.notifyUser(purchase.submittedById, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} rejected lab supply purchase order ${purchase.purchaseNumber}`,
        link: '/inventory/lab-supplies/purchases',
        meta: { purchaseId: saved.id },
      });
    }

    return this.withPaymentInfo(saved);
  }

  // Stage 2: Administrator approves or rejects a submitted purchase
  async adminReviewPurchase(id: string, dto: AdminReviewLabSupplyPurchaseDto, userId: string, userName: string, userAvatar?: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== LabSupplyPurchaseApprovalStatus.DEPT_HEAD_APPROVED) {
      throw new BadRequestException('Purchase is not awaiting admin review');
    }
    purchase.approvalStatus =
      dto.decision === LabSupplyPurchaseReviewDecision.APPROVE
        ? LabSupplyPurchaseApprovalStatus.ADMIN_APPROVED
        : LabSupplyPurchaseApprovalStatus.ADMIN_REJECTED;
    purchase.reviewedById = userId;
    purchase.reviewedByName = userName;
    purchase.reviewedAt = new Date();
    if (dto.decision === LabSupplyPurchaseReviewDecision.REJECT) {
      purchase.rejectionReason = dto.notes ?? '';
    }
    const saved = await this.purchasesRepo.save(purchase);

    if (purchase.submittedById) {
      const verb = dto.decision === LabSupplyPurchaseReviewDecision.APPROVE ? 'approved' : 'rejected';
      await this.notifyUser(purchase.submittedById, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} ${verb} lab supply purchase order ${purchase.purchaseNumber}`,
        link: '/inventory/lab-supplies/purchases',
        meta: { purchaseId: saved.id },
      });
    }

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
        where: { approvalStatus: LabSupplyPurchaseApprovalStatus.SUBMITTED },
        relations: ['items', 'items.labSupply'],
        order: { createdAt: 'DESC' },
      });
      return purchases.map((p) => this.withPaymentInfo(p));
    }
    const submitted = await this.purchasesRepo.find({
      where: { approvalStatus: LabSupplyPurchaseApprovalStatus.SUBMITTED },
      relations: ['items', 'items.labSupply'],
      order: { createdAt: 'DESC' },
    });
    const mine: typeof submitted = [];
    for (const p of submitted) {
      if (p.submittedById && (await this.findDeptHeadId(p.submittedById)) === userId) mine.push(p);
    }
    return mine.map((p) => this.withPaymentInfo(p));
  }

  // Stage 3: Accountant closes out an admin-approved purchase once balance is $0
  async markPurchasePaid(id: string, dto: MarkLabSupplyPurchasePaidDto, userId: string, userName: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== LabSupplyPurchaseApprovalStatus.ADMIN_APPROVED) {
      throw new BadRequestException('Purchase must be admin-approved before it can be marked as paid');
    }
    const dueAmount = Math.max(0, Number(purchase.totalAmount) - Number(purchase.paidAmount));
    if (dueAmount > 0.01) {
      throw new BadRequestException(
        `Cannot mark as paid — outstanding balance of $${dueAmount.toFixed(2)} remains`,
      );
    }
    purchase.approvalStatus = LabSupplyPurchaseApprovalStatus.PAID;
    purchase.paidById = userId;
    purchase.paidByName = userName;
    purchase.paidAt = new Date();
    const saved = await this.purchasesRepo.save(purchase);
    return this.withPaymentInfo(saved);
  }
}
