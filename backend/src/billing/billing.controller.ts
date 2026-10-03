import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BillingService } from './billing.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Permissions('billing:read')
  @Get('invoices')
  getAll(@Query('patientId') patientId?: string, @Query('search') search?: string) {
    return this.billingService.getAll(patientId, search);
  }

  @Permissions('billing:read')
  @Get('invoices/:id')
  getOne(@Param('id') id: string) {
    return this.billingService.getOne(id);
  }

  @Permissions('billing:read')
  @Get('payments')
  getAllPayments() {
    return this.billingService.getAllPayments();
  }

  @Permissions('billing:read')
  @Get('visit-summary/:visitId')
  getVisitSummary(@Param('visitId') visitId: string) {
    return this.billingService.getVisitSummary(visitId);
  }

  @Get('services-search')
  searchServices(@Query('search') search?: string) {
    return this.billingService.searchServices(search);
  }

  @Permissions('billing:create')
  @Post('invoices')
  create(@Body() dto: CreateInvoiceDto, @Req() req: AuthenticatedRequest) {
    return this.billingService.create(dto, req.user.id);
  }

  @Permissions('billing:update')
  @Post('invoices/:id/payments')
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @Req() req: AuthenticatedRequest) {
    return this.billingService.recordPayment(id, dto, req.user?.fullName);
  }

  @Permissions('billing:delete')
  @Delete('invoices/:id')
  remove(@Param('id') id: string) {
    return this.billingService.remove(id);
  }
}
