import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReturnReason, ReturnType } from './entities/sale-return.entity';
import { PharmacyService } from './pharmacy.service';
import { CreateMedicineDto } from './dto/create-medicine.dto';
import { UpdateMedicineDto } from './dto/update-medicine.dto';
import { RestockMedicineDto } from './dto/restock-medicine.dto';
import { DispensePrescriptionDto } from './dto/dispense-prescription.dto';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { RecordPurchasePaymentDto } from './dto/record-purchase-payment.dto';
import { AdminReviewPurchaseDto } from './dto/admin-review-purchase.dto';
import { DeptHeadReviewPurchaseDto } from './dto/dept-head-review-purchase.dto';
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
    return this.pharmacyService.dispense(id, dto, req.user?.fullName, req.user?.profilePhoto);
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

  // Purchases waiting on THIS user as dept head.
  // Must be declared before 'purchases/:id' so the literal path wins.
  @Get('purchases/dept-head-queue')
  getPurchasesDeptHeadQueue(@Request() req: any) {
    const isAdmin = !!req.user?.roles?.includes('administrator');
    return this.pharmacyService.findAwaitingDeptHeadReview(req.user?.id, isAdmin);
  }

  // True when the caller is linked to an org chart box or heads a department.
  @Get('purchases/is-approver')
  isPurchaseApprover(@Request() req: any) {
    return this.pharmacyService.isApprover(req.user?.id);
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
    return this.pharmacyService.createPurchase(dto, req.user?.id, req.user?.username, req.user?.profilePhoto);
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

  // Stage 1.5: department head approves or rejects (or an administrator overrides).
  // Not gated by @Roles — any authenticated user may attempt it; the service
  // enforces "must be this submitter's actual department head, or administrator."
  @Patch('purchases/:id/dept-head-review')
  deptHeadReviewPurchase(@Param('id') id: string, @Body() dto: DeptHeadReviewPurchaseDto, @Request() req: any) {
    const isAdmin = !!req.user?.roles?.includes('administrator');
    return this.pharmacyService.deptHeadReviewPurchase(id, dto, req.user?.id, req.user?.username, req.user?.profilePhoto, isAdmin);
  }

  // Stage 2: administrator approves or rejects
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch('purchases/:id/admin-review')
  adminReviewPurchase(@Param('id') id: string, @Body() dto: AdminReviewPurchaseDto, @Request() req: any) {
    return this.pharmacyService.adminReviewPurchase(id, dto, req.user?.id, req.user?.username, req.user?.profilePhoto);
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
  createSale(@Body() dto: CreateSaleDto, @Request() req: any) {
    return this.pharmacyService.createSale(dto, req.user?.name ?? req.user?.username);
  }

  @Patch('sales/:id/void')
  voidSale(@Param('id') id: string) {
    return this.pharmacyService.voidSale(id);
  }
  @Get('returns')
  getAllReturns() {
    return this.pharmacyService.findAllReturns();
  }

  @Post('returns')
  createReturn(
    @Body() body: {
      type: ReturnType;
      saleId?: string;
      saleItemId?: string;
      prescriptionId?: string;
      quantity: number;
      reason: ReturnReason;
      notes?: string;
      processedBy?: string;
    },
    @Request() req: any,
  ) {
    return this.pharmacyService.createReturn({
      ...body,
      processedBy: body.processedBy ?? req.user?.name ?? req.user?.username,
    });
  }

}
