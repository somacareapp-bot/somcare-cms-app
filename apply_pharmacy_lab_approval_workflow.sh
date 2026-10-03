#!/usr/bin/env bash
# Adds the approval workflow to Pharmacy Purchases and Lab Supply Purchases:
#   Submitted (Pharmacist / Laboratory) -> Admin Review (Administrator) -> Accountant Paid
#
# Run this from your project root:
#   cd "/Users/adminnopassword/Documents/Clinical MS/cms"
#   bash apply_pharmacy_lab_approval_workflow.sh
#
# It OVERWRITES the files listed below with new versions that include the
# approval workflow, and ADDS a few new DTO files. Existing behavior
# (goods-receipt status, payment tracking) is preserved untouched.

set -e

echo "Patching Pharmacy module..."

# ---------------------------------------------------------------------------
# 1. backend/src/pharmacy/entities/purchase.entity.ts
# ---------------------------------------------------------------------------
cat > backend/src/pharmacy/entities/purchase.entity.ts << 'FILEEOF'
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { PurchaseItem } from './purchase-item.entity';

export enum PurchaseStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export enum PurchaseApprovalStatus {
  SUBMITTED = 'submitted',           // just created by pharmacist
  ADMIN_APPROVED = 'admin_approved', // administrator approved
  ADMIN_REJECTED = 'admin_rejected', // administrator rejected
  PAID = 'paid',                     // accountant closed it out (balance is $0)
}

@Entity('purchases')
export class Purchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_number', unique: true })
  purchaseNumber: string;

  @Column({ name: 'supplier_name' })
  supplierName: string;

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.PENDING })
  status: PurchaseStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @OneToMany(() => PurchaseItem, (i) => i.purchase, { cascade: true, eager: true })
  items: PurchaseItem[];

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ----- Approval workflow: Submitted -> Admin Review -> Accountant Paid -----
  @Column({ type: 'enum', enum: PurchaseApprovalStatus, default: PurchaseApprovalStatus.SUBMITTED, name: 'approval_status' })
  approvalStatus: PurchaseApprovalStatus;

  @Column({ name: 'submitted_by_id', nullable: true })
  submittedById: string;

  @Column({ name: 'submitted_by_name', nullable: true })
  submittedByName: string;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @Column({ name: 'reviewed_by_name', nullable: true })
  reviewedByName: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'paid_by_id', nullable: true })
  paidById: string;

  @Column({ name: 'paid_by_name', nullable: true })
  paidByName: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;
}
FILEEOF

# ---------------------------------------------------------------------------
# 2. backend/src/pharmacy/dto/admin-review-purchase.dto.ts  (new)
# ---------------------------------------------------------------------------
cat > backend/src/pharmacy/dto/admin-review-purchase.dto.ts << 'FILEEOF'
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum PurchaseReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Administrator's decision on a submitted purchase
export class AdminReviewPurchaseDto {
  @IsEnum(PurchaseReviewDecision)
  decision: PurchaseReviewDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
FILEEOF

# ---------------------------------------------------------------------------
# 3. backend/src/pharmacy/dto/mark-purchase-paid.dto.ts  (new)
# ---------------------------------------------------------------------------
cat > backend/src/pharmacy/dto/mark-purchase-paid.dto.ts << 'FILEEOF'
import { IsOptional, IsString } from 'class-validator';

// Accountant closes out an admin-approved purchase once the balance is $0
export class MarkPurchasePaidDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
FILEEOF

# ---------------------------------------------------------------------------
# 4. backend/src/pharmacy/pharmacy.service.ts
# ---------------------------------------------------------------------------
cat > backend/src/pharmacy/pharmacy.service.ts << 'FILEEOF'
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Medicine } from './entities/medicine.entity';
import { Purchase, PurchaseStatus, PurchaseApprovalStatus } from './entities/purchase.entity';
import { PurchaseItem } from './entities/purchase-item.entity';
import { Sale, SaleStatus } from './entities/sale.entity';
import { SaleItem } from './entities/sale-item.entity';
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
  ) {}

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

  async dispense(id: string, dto: DispensePrescriptionDto, dispensedByName?: string): Promise<Prescription> {
    const prescription = await this.prescriptionsRepo.findOne({ where: { id }, relations: ['medicine'] });
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

    prescription.medicineId = medicine.id;
    prescription.quantity = dto.quantity;
    prescription.status = PrescriptionStatus.DISPENSED;
    prescription.dispensedAt = new Date();
    if (dispensedByName) prescription.dispensedByName = dispensedByName;
    return this.prescriptionsRepo.save(prescription);
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

  async createPurchase(dto: CreatePurchaseDto, submittedById?: string, submittedByName?: string): Promise<Purchase> {
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

    const purchase = this.purchasesRepo.create({
      purchaseNumber: await this.generatePurchaseNumber(),
      supplierName: dto.supplierName,
      invoiceNumber: dto.invoiceNumber,
      totalAmount,
      items,
      approvalStatus: PurchaseApprovalStatus.SUBMITTED,
      submittedById,
      submittedByName,
    });
    const saved = await this.purchasesRepo.save(purchase);
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
    return this.withPaymentInfo(saved);
  }

  async cancelPurchase(id: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status !== PurchaseStatus.PENDING) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }
    purchase.status = PurchaseStatus.CANCELLED;
    const saved = await this.purchasesRepo.save(purchase);
    return this.withPaymentInfo(saved);
  }

  // Stage 2: Administrator approves or rejects a submitted purchase
  async adminReviewPurchase(id: string, dto: AdminReviewPurchaseDto, userId: string, userName: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== PurchaseApprovalStatus.SUBMITTED) {
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

  async createSale(dto: CreateSaleDto): Promise<any> {
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
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      customerAddress: dto.customerAddress,
      subtotalAmount,
      discountAmount,
      taxAmount,
      totalAmount,
      paidAmount,
      paymentMethod: dto.paymentMethod,
      cashierName: dto.cashierName,
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
}
FILEEOF

# ---------------------------------------------------------------------------
# 5. backend/src/pharmacy/pharmacy.controller.ts
# ---------------------------------------------------------------------------
cat > backend/src/pharmacy/pharmacy.controller.ts << 'FILEEOF'
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { PharmacyService } from './pharmacy.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { RestockMedicineDto } from './dto/restock-medicine.dto';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordPurchasePaymentDto } from './dto/record-purchase-payment.dto';
import { AdminReviewPurchaseDto } from './dto/admin-review-purchase.dto';
import { MarkPurchasePaidDto } from './dto/mark-purchase-paid.dto';
import { PrescriptionStatus } from '../visits/entities/prescription.entity';
import { PurchaseStatus, PurchaseApprovalStatus } from './entities/purchase.entity';

@UseGuards(JwtAuthGuard)
@Controller('pharmacy')
export class PharmacyController {
  constructor(private readonly pharmacyService: PharmacyService) {}

  @Get('dashboard')
  getDashboard() {
    return this.pharmacyService.getDashboardStats();
  }

  // Medicines
  @Get('medicines')
  findAllMedicines(@Query('search') search?: string) {
    return this.pharmacyService.findAllMedicines(search);
  }

  @Get('medicines/low-stock')
  findLowStock() {
    return this.pharmacyService.findLowStock();
  }

  @Post('medicines')
  createMedicine(@Body() dto: CreateMedicineDto) {
    return this.pharmacyService.createMedicine(dto);
  }

  @Patch('medicines/:id')
  updateMedicine(@Param('id') id: string, @Body() dto: UpdateMedicineDto) {
    return this.pharmacyService.updateMedicine(id, dto);
  }

  @Patch('medicines/:id/restock')
  restockMedicine(@Param('id') id: string, @Body() dto: RestockMedicineDto) {
    return this.pharmacyService.restockMedicine(id, dto);
  }

  @Delete('medicines/:id')
  deactivateMedicine(@Param('id') id: string) {
    return this.pharmacyService.deactivateMedicine(id);
  }

  // Prescriptions
  @Get('prescriptions')
  findPrescriptions(@Query('status') status?: PrescriptionStatus) {
    return this.pharmacyService.findPrescriptions(status);
  }

  @Post('prescriptions/:id/dispense')
  dispense(@Param('id') id: string, @Body() dto: DispensePrescriptionDto, @Request() req: any) {
    return this.pharmacyService.dispense(id, dto, req.user?.username);
  }

  @Patch('prescriptions/:id/cancel')
  cancelPrescription(@Param('id') id: string) {
    return this.pharmacyService.cancelPrescription(id);
  }

  // Purchases
  @Get('purchases')
  findAllPurchases(
    @Query('status') status?: PurchaseStatus,
    @Query('approvalStatus') approvalStatus?: PurchaseApprovalStatus,
  ) {
    return this.pharmacyService.findAllPurchases(status, approvalStatus);
  }

  @Get('purchases/:id')
  findOnePurchase(@Param('id') id: string) {
    return this.pharmacyService.findOnePurchase(id);
  }

  // Stage 1: pharmacist (or admin) submits the purchase
  @UseGuards(RolesGuard)
  @Roles('pharmacist', 'administrator')
  @Post('purchases')
  createPurchase(@Body() dto: CreatePurchaseDto, @Request() req: any) {
    return this.pharmacyService.createPurchase(dto, req.user?.id, req.user?.username);
  }

  @Patch('purchases/:id/confirm')
  confirmPurchase(@Param('id') id: string) {
    return this.pharmacyService.confirmPurchase(id);
  }

  @Patch('purchases/:id/payment')
  recordPurchasePayment(@Param('id') id: string, @Body() dto: RecordPurchasePaymentDto) {
    return this.pharmacyService.recordPayment(id, dto);
  }

  @Patch('purchases/:id/cancel')
  cancelPurchase(@Param('id') id: string) {
    return this.pharmacyService.cancelPurchase(id);
  }

  // Stage 2: administrator approves or rejects
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch('purchases/:id/admin-review')
  adminReviewPurchase(@Param('id') id: string, @Body() dto: AdminReviewPurchaseDto, @Request() req: any) {
    return this.pharmacyService.adminReviewPurchase(id, dto, req.user?.id, req.user?.username);
  }

  // Stage 3: accountant closes it out once balance is $0
  @UseGuards(RolesGuard)
  @Roles('accountant', 'administrator')
  @Patch('purchases/:id/mark-paid')
  markPurchasePaid(@Param('id') id: string, @Body() dto: MarkPurchasePaidDto, @Request() req: any) {
    return this.pharmacyService.markPurchasePaid(id, dto, req.user?.id, req.user?.username);
  }

  // POS / Sales
  @Get('sales')
  findSales() {
    return this.pharmacyService.findSales();
  }

  @Get('sales/:id')
  findOneSale(@Param('id') id: string) {
    return this.pharmacyService.findOneSale(id);
  }

  @Post('sales')
  createSale(@Body() dto: CreateSaleDto) {
    return this.pharmacyService.createSale(dto);
  }

  @Patch('sales/:id/void')
  voidSale(@Param('id') id: string) {
    return this.pharmacyService.voidSale(id);
  }
}
FILEEOF

echo "Pharmacy module patched."
echo "Patching Inventory (Lab Supplies) module..."

# ---------------------------------------------------------------------------
# 6. backend/src/inventory/entities/lab-supply-purchase.entity.ts
# ---------------------------------------------------------------------------
cat > backend/src/inventory/entities/lab-supply-purchase.entity.ts << 'FILEEOF'
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { LabSupplyPurchaseItem } from './lab-supply-purchase-item.entity';

export enum LabSupplyPurchaseStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export enum LabSupplyPurchaseApprovalStatus {
  SUBMITTED = 'submitted',           // just created by lab technician
  ADMIN_APPROVED = 'admin_approved', // administrator approved
  ADMIN_REJECTED = 'admin_rejected', // administrator rejected
  PAID = 'paid',                     // accountant closed it out (balance is $0)
}

@Entity('lab_supply_purchases')
export class LabSupplyPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_number', unique: true })
  purchaseNumber: string;

  @Column({ name: 'supplier_name' })
  supplierName: string;

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @Column({ type: 'enum', enum: LabSupplyPurchaseStatus, default: LabSupplyPurchaseStatus.PENDING })
  status: LabSupplyPurchaseStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @OneToMany(() => LabSupplyPurchaseItem, (i) => i.purchase, { cascade: true, eager: true })
  items: LabSupplyPurchaseItem[];

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ----- Approval workflow: Submitted -> Admin Review -> Accountant Paid -----
  @Column({ type: 'enum', enum: LabSupplyPurchaseApprovalStatus, default: LabSupplyPurchaseApprovalStatus.SUBMITTED, name: 'approval_status' })
  approvalStatus: LabSupplyPurchaseApprovalStatus;

  @Column({ name: 'submitted_by_id', nullable: true })
  submittedById: string;

  @Column({ name: 'submitted_by_name', nullable: true })
  submittedByName: string;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @Column({ name: 'reviewed_by_name', nullable: true })
  reviewedByName: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'paid_by_id', nullable: true })
  paidById: string;

  @Column({ name: 'paid_by_name', nullable: true })
  paidByName: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;
}
FILEEOF

# ---------------------------------------------------------------------------
# 7. backend/src/inventory/dto/admin-review-lab-supply-purchase.dto.ts (new)
# ---------------------------------------------------------------------------
cat > backend/src/inventory/dto/admin-review-lab-supply-purchase.dto.ts << 'FILEEOF'
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum LabSupplyPurchaseReviewDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
}

// Administrator's decision on a submitted lab supply purchase
export class AdminReviewLabSupplyPurchaseDto {
  @IsEnum(LabSupplyPurchaseReviewDecision)
  decision: LabSupplyPurchaseReviewDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
FILEEOF

# ---------------------------------------------------------------------------
# 8. backend/src/inventory/dto/mark-lab-supply-purchase-paid.dto.ts (new)
# ---------------------------------------------------------------------------
cat > backend/src/inventory/dto/mark-lab-supply-purchase-paid.dto.ts << 'FILEEOF'
import { IsOptional, IsString } from 'class-validator';

// Accountant closes out an admin-approved lab supply purchase once the balance is $0
export class MarkLabSupplyPurchasePaidDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
FILEEOF

# ---------------------------------------------------------------------------
# 9. backend/src/inventory/inventory.service.ts
# ---------------------------------------------------------------------------
cat > backend/src/inventory/inventory.service.ts << 'FILEEOF'
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { LabSupply } from './entities/lab-supply.entity';
import { LabSupplyPurchase, LabSupplyPurchaseStatus, LabSupplyPurchaseApprovalStatus } from './entities/lab-supply-purchase.entity';
import { LabSupplyPurchaseItem } from './entities/lab-supply-purchase-item.entity';
import { LabSupplyStockLog, LabSupplyStockLogType } from './entities/lab-supply-stock-log.entity';
import { CreateLabSupplyDto } from './dto/create-lab-supply.dto';
import { UpdateLabSupplyDto } from './dto/update-lab-supply.dto';
import { RestockLabSupplyDto } from './dto/restock-lab-supply.dto';
import { IssueLabSupplyDto } from './dto/issue-lab-supply.dto';
import { CreateLabSupplyPurchaseDto } from './dto/create-lab-supply-purchase.dto';
import { RecordLabSupplyPurchasePaymentDto } from './dto/record-lab-supply-purchase-payment.dto';
import { AdminReviewLabSupplyPurchaseDto, LabSupplyPurchaseReviewDecision } from './dto/admin-review-lab-supply-purchase.dto';
import { MarkLabSupplyPurchasePaidDto } from './dto/mark-lab-supply-purchase-paid.dto';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(LabSupply) private readonly labSuppliesRepo: Repository<LabSupply>,
    @InjectRepository(LabSupplyPurchase) private readonly purchasesRepo: Repository<LabSupplyPurchase>,
    @InjectRepository(LabSupplyPurchaseItem) private readonly purchaseItemsRepo: Repository<LabSupplyPurchaseItem>,
    @InjectRepository(LabSupplyStockLog) private readonly stockLogsRepo: Repository<LabSupplyStockLog>,
  ) {}

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

  async restockSupply(id: string, dto: RestockLabSupplyDto) {
    const supply = await this.findOneSupply(id);
    const previousStock = supply.stockQuantity;
    supply.stockQuantity += dto.quantity;
    const saved = await this.labSuppliesRepo.save(supply);

    await this.stockLogsRepo.save(
      this.stockLogsRepo.create({
        labSupplyId: id,
        type: LabSupplyStockLogType.RESTOCK,
        quantity: dto.quantity,
        previousStock,
        newStock: saved.stockQuantity,
        reason: dto.reason,
      }),
    );

    return saved;
  }

  async issueSupply(id: string, dto: IssueLabSupplyDto) {
    const supply = await this.findOneSupply(id);
    const previousStock = supply.stockQuantity;

    if (dto.quantity > previousStock) {
      throw new BadRequestException(
        `Insufficient stock: requested ${dto.quantity}, available ${previousStock}`,
      );
    }

    supply.stockQuantity -= dto.quantity;
    const saved = await this.labSuppliesRepo.save(supply);

    await this.stockLogsRepo.save(
      this.stockLogsRepo.create({
        labSupplyId: id,
        type: LabSupplyStockLogType.ISSUE,
        quantity: dto.quantity,
        previousStock,
        newStock: saved.stockQuantity,
        reason: dto.reason,
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

  async createPurchase(dto: CreateLabSupplyPurchaseDto, submittedById?: string, submittedByName?: string): Promise<any> {
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

    const purchase = this.purchasesRepo.create({
      purchaseNumber: await this.generatePurchaseNumber(),
      supplierName: dto.supplierName,
      invoiceNumber: dto.invoiceNumber,
      totalAmount,
      paidAmount: dto.paidAmount ?? 0,
      items,
      approvalStatus: LabSupplyPurchaseApprovalStatus.SUBMITTED,
      submittedById,
      submittedByName,
    });
    const saved = await this.purchasesRepo.save(purchase);
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
    return this.withPaymentInfo(saved);
  }

  async cancelPurchase(id: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.status !== LabSupplyPurchaseStatus.PENDING) {
      throw new BadRequestException(`Purchase is already ${purchase.status}`);
    }
    purchase.status = LabSupplyPurchaseStatus.CANCELLED;
    const saved = await this.purchasesRepo.save(purchase);
    return this.withPaymentInfo(saved);
  }

  // Stage 2: Administrator approves or rejects a submitted purchase
  async adminReviewPurchase(id: string, dto: AdminReviewLabSupplyPurchaseDto, userId: string, userName: string) {
    const purchase = await this.getPurchaseEntity(id);
    if (purchase.approvalStatus !== LabSupplyPurchaseApprovalStatus.SUBMITTED) {
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
    return this.withPaymentInfo(saved);
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
FILEEOF

# ---------------------------------------------------------------------------
# 10. backend/src/inventory/inventory.controller.ts
# ---------------------------------------------------------------------------
cat > backend/src/inventory/inventory.controller.ts << 'FILEEOF'
import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InventoryService } from './inventory.service';
import { CreateLabSupplyDto } from './dto/create-lab-supply.dto';
import { UpdateLabSupplyDto } from './dto/update-lab-supply.dto';
import { RestockLabSupplyDto } from './dto/restock-lab-supply.dto';
import { IssueLabSupplyDto } from './dto/issue-lab-supply.dto';
import { CreateLabSupplyPurchaseDto } from './dto/create-lab-supply-purchase.dto';
import { RecordLabSupplyPurchasePaymentDto } from './dto/record-lab-supply-purchase-payment.dto';
import { AdminReviewLabSupplyPurchaseDto } from './dto/admin-review-lab-supply-purchase.dto';
import { MarkLabSupplyPurchasePaidDto } from './dto/mark-lab-supply-purchase-paid.dto';
import { LabSupplyPurchaseStatus, LabSupplyPurchaseApprovalStatus } from './entities/lab-supply-purchase.entity';

@UseGuards(JwtAuthGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // Lab Supplies (catalog)
  @Get('lab-supplies')
  findAllSupplies(@Query('search') search?: string) {
    return this.inventoryService.findAllSupplies(search);
  }

  @Get('lab-supplies/low-stock')
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Post('lab-supplies')
  createSupply(@Body() dto: CreateLabSupplyDto) {
    return this.inventoryService.createSupply(dto);
  }

  @Patch('lab-supplies/:id')
  updateSupply(@Param('id') id: string, @Body() dto: UpdateLabSupplyDto) {
    return this.inventoryService.updateSupply(id, dto);
  }

  @Patch('lab-supplies/:id/restock')
  restockSupply(@Param('id') id: string, @Body() dto: RestockLabSupplyDto) {
    return this.inventoryService.restockSupply(id, dto);
  }

  @Patch('lab-supplies/:id/issue')
  issueSupply(@Param('id') id: string, @Body() dto: IssueLabSupplyDto) {
    return this.inventoryService.issueSupply(id, dto);
  }

  @Get('lab-supplies/:id/stock-logs')
  findStockLogs(@Param('id') id: string) {
    return this.inventoryService.findStockLogs(id);
  }

  @Delete('lab-supplies/:id')
  deactivateSupply(@Param('id') id: string) {
    return this.inventoryService.deactivateSupply(id);
  }

  // Purchases (goods receipt)
  @Get('lab-supplies/purchases')
  findAllPurchases(
    @Query('status') status?: LabSupplyPurchaseStatus,
    @Query('approvalStatus') approvalStatus?: LabSupplyPurchaseApprovalStatus,
  ) {
    return this.inventoryService.findAllPurchases(status, approvalStatus);
  }

  @Get('lab-supplies/purchases/:id')
  findOnePurchase(@Param('id') id: string) {
    return this.inventoryService.findOnePurchase(id);
  }

  // Stage 1: lab technician (or admin) submits the purchase
  @UseGuards(RolesGuard)
  @Roles('laboratory', 'administrator')
  @Post('lab-supplies/purchases')
  createPurchase(@Body() dto: CreateLabSupplyPurchaseDto, @Request() req: any) {
    return this.inventoryService.createPurchase(dto, req.user?.id, req.user?.username);
  }

  @Patch('lab-supplies/purchases/:id/confirm')
  confirmPurchase(@Param('id') id: string) {
    return this.inventoryService.confirmPurchase(id);
  }

  @Patch('lab-supplies/purchases/:id/payment')
  recordPurchasePayment(@Param('id') id: string, @Body() dto: RecordLabSupplyPurchasePaymentDto) {
    return this.inventoryService.recordPayment(id, dto);
  }

  @Patch('lab-supplies/purchases/:id/cancel')
  cancelPurchase(@Param('id') id: string) {
    return this.inventoryService.cancelPurchase(id);
  }

  // Stage 2: administrator approves or rejects
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch('lab-supplies/purchases/:id/admin-review')
  adminReviewPurchase(@Param('id') id: string, @Body() dto: AdminReviewLabSupplyPurchaseDto, @Request() req: any) {
    return this.inventoryService.adminReviewPurchase(id, dto, req.user?.id, req.user?.username);
  }

  // Stage 3: accountant closes it out once balance is $0
  @UseGuards(RolesGuard)
  @Roles('accountant', 'administrator')
  @Patch('lab-supplies/purchases/:id/mark-paid')
  markPurchasePaid(@Param('id') id: string, @Body() dto: MarkLabSupplyPurchasePaidDto, @Request() req: any) {
    return this.inventoryService.markPurchasePaid(id, dto, req.user?.id, req.user?.username);
  }
}
FILEEOF

echo "Inventory (Lab Supplies) module patched."

# ---------------------------------------------------------------------------
# 11. SQL migration (run manually if you don't use synchronize:true)
# ---------------------------------------------------------------------------
cat > add_purchase_approval_workflow.sql << 'FILEEOF'
-- Pharmacy purchases
CREATE TYPE purchases_approval_status_enum AS ENUM ('submitted', 'admin_approved', 'admin_rejected', 'paid');
ALTER TABLE purchases
  ADD COLUMN approval_status purchases_approval_status_enum NOT NULL DEFAULT 'submitted',
  ADD COLUMN submitted_by_id varchar NULL,
  ADD COLUMN submitted_by_name varchar NULL,
  ADD COLUMN reviewed_by_id varchar NULL,
  ADD COLUMN reviewed_by_name varchar NULL,
  ADD COLUMN reviewed_at timestamptz NULL,
  ADD COLUMN rejection_reason text NULL,
  ADD COLUMN paid_by_id varchar NULL,
  ADD COLUMN paid_by_name varchar NULL,
  ADD COLUMN paid_at timestamptz NULL;

-- Backfill existing rows sensibly: already-confirmed/paid purchases are
-- treated as already approved so they don't get stuck in a review queue.
UPDATE purchases SET approval_status = 'admin_approved' WHERE status = 'confirmed';

-- Lab supply purchases
CREATE TYPE lab_supply_purchases_approval_status_enum AS ENUM ('submitted', 'admin_approved', 'admin_rejected', 'paid');
ALTER TABLE lab_supply_purchases
  ADD COLUMN approval_status lab_supply_purchases_approval_status_enum NOT NULL DEFAULT 'submitted',
  ADD COLUMN submitted_by_id varchar NULL,
  ADD COLUMN submitted_by_name varchar NULL,
  ADD COLUMN reviewed_by_id varchar NULL,
  ADD COLUMN reviewed_by_name varchar NULL,
  ADD COLUMN reviewed_at timestamptz NULL,
  ADD COLUMN rejection_reason text NULL,
  ADD COLUMN paid_by_id varchar NULL,
  ADD COLUMN paid_by_name varchar NULL,
  ADD COLUMN paid_at timestamptz NULL;

UPDATE lab_supply_purchases SET approval_status = 'admin_approved' WHERE status = 'confirmed';
FILEEOF

echo ""
echo "Done."
echo ""
echo "NEXT STEPS:"
echo "1. If your TypeORM config has synchronize:true (dev), just restart the backend — the new columns/enums are created automatically."
echo "   Otherwise, run: psql <your-db> -f add_purchase_approval_workflow.sql"
echo "2. Restart the backend and hit:"
echo "     POST   /pharmacy/purchases                       (pharmacist/admin submits)"
echo "     PATCH  /pharmacy/purchases/:id/admin-review       (admin approve/reject)"
echo "     PATCH  /pharmacy/purchases/:id/mark-paid          (accountant closes out)"
echo "     POST   /inventory/lab-supplies/purchases          (laboratory/admin submits)"
echo "     PATCH  /inventory/lab-supplies/purchases/:id/admin-review"
echo "     PATCH  /inventory/lab-supplies/purchases/:id/mark-paid"
echo "3. Frontend wiring (badges + approve/reject/mark-paid buttons on both Purchases pages,"
echo "   plus the pharmacyApi/inventoryApi client methods) is next — see the follow-up message."
FILEEOF
