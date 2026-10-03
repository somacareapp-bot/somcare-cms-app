import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { LaboratoryService } from './laboratory.service';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { UpdateLabResultDto } from './dto/update-lab-result.dto';
import { LabOrderStatus } from './entities/lab-order.entity';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('laboratory')
export class LaboratoryController {
  constructor(private readonly laboratoryService: LaboratoryService) {}

  @Permissions('laboratory:read')
  @Get('queue')
  findQueue() {
    return this.laboratoryService.findQueue();
  }

  @Permissions('laboratory:read')
  @Get('by-visit/:visitId')
  findByVisit(@Param('visitId') visitId: string) {
    return this.laboratoryService.findByVisit(visitId);
  }

  @Permissions('laboratory:read')
  @Get()
  findAll(
    @Query('status') status?: LabOrderStatus,
    @Query('patientId') patientId?: string,
  ) {
    return this.laboratoryService.findAll(status, patientId);
  }

  @Permissions('laboratory:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.laboratoryService.findOne(id);
  }

  // Dry run: what marking this sample collected would consume, and whether stock
  // covers it. Call this before PATCH :id/status with sample_collected — that is
  // now where the deduction happens, not at result entry.
  @Permissions('laboratory:read')
  @Get(':id/consumption-preview')
  previewConsumption(@Param('id') id: string) {
    return this.laboratoryService.previewConsumption(id);
  }

  @Permissions('laboratory:create')
  @Post()
  create(@Body() dto: CreateLabOrderDto) {
    return this.laboratoryService.create(dto);
  }

  @Permissions('laboratory:update')
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateLabOrderStatusDto,
    @Request() req: any,
  ) {
    // Stock is dispensed when the sample is marked collected, so the stock-log
    // createdBy has to come from the authenticated user. Spread rather than
    // mutate, so a userId sent in the body can never override the JWT identity.
    return this.laboratoryService.updateStatus(id, { ...dto, userId: req.user?.id });
  }

  @Permissions('laboratory:update')
  @Patch(':id/result')
  updateResult(@Param('id') id: string, @Body() dto: UpdateLabResultDto, @Request() req: any) {
    // req.user comes from JwtStrategy.validate(): { id, username, roles, permissions }
    return this.laboratoryService.updateResult(id, dto, req.user?.fullName, req.user?.id);
  }
}