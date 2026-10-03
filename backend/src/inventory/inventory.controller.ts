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
import { DeptHeadReviewLabSupplyPurchaseDto } from './dto/dept-head-review-lab-supply-purchase.dto';
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

  // Purchases waiting on THIS user as dept head.
  // Must be declared before 'purchases/:id' so the literal path wins.
  @Get('lab-supplies/purchases/dept-head-queue')
  getPurchasesDeptHeadQueue(@Request() req: any) {
    const isAdmin = !!req.user?.roles?.includes('administrator');
    return this.inventoryService.findAwaitingDeptHeadReview(req.user?.id, isAdmin);
  }

  // True when the caller is linked to an org chart box or heads a department.
  @Get('lab-supplies/purchases/is-approver')
  isPurchaseApprover(@Request() req: any) {
    return this.inventoryService.isApprover(req.user?.id);
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
    return this.inventoryService.createPurchase(dto, req.user?.id, req.user?.username, req.user?.profilePhoto);
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

  // Stage 1.5: department head approves or rejects (or an administrator overrides).
  // Not gated by @Roles — any authenticated user may attempt it; the service
  // enforces "must be this submitter's actual department head, or administrator."
  @Patch('lab-supplies/purchases/:id/dept-head-review')
  deptHeadReviewPurchase(@Param('id') id: string, @Body() dto: DeptHeadReviewLabSupplyPurchaseDto, @Request() req: any) {
    const isAdmin = !!req.user?.roles?.includes('administrator');
    return this.inventoryService.deptHeadReviewPurchase(id, dto, req.user?.id, req.user?.username, req.user?.profilePhoto, isAdmin);
  }

  // Stage 2: administrator approves or rejects
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch('lab-supplies/purchases/:id/admin-review')
  adminReviewPurchase(@Param('id') id: string, @Body() dto: AdminReviewLabSupplyPurchaseDto, @Request() req: any) {
    return this.inventoryService.adminReviewPurchase(id, dto, req.user?.id, req.user?.username, req.user?.profilePhoto);
  }

  // Stage 3: accountant closes it out once balance is $0
  @UseGuards(RolesGuard)
  @Roles('accountant', 'administrator')
  @Patch('lab-supplies/purchases/:id/mark-paid')
  markPurchasePaid(@Param('id') id: string, @Body() dto: MarkLabSupplyPurchasePaidDto, @Request() req: any) {
    return this.inventoryService.markPurchasePaid(id, dto, req.user?.id, req.user?.username);
  }
}
