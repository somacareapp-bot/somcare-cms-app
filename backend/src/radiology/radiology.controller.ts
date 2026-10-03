import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RadiologyService } from './radiology.service';
import { CreateRadiologyOrderDto } from './dto/create-radiology-order.dto';
import { UpdateRadiologyOrderStatusDto } from './dto/update-radiology-order-status.dto';
import { UpdateRadiologyResultDto } from './dto/update-radiology-result.dto';
import { RadiologyOrderStatus } from './entities/radiology-order.entity';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('radiology')
export class RadiologyController {
  constructor(private readonly radiologyService: RadiologyService) {}

  @Permissions('radiology:read')
  @Get('queue')
  findQueue() {
    return this.radiologyService.findQueue();
  }

  @Permissions('radiology:read')
  @Get('by-visit/:visitId')
  findByVisit(@Param('visitId') visitId: string) {
    return this.radiologyService.findByVisit(visitId);
  }

  @Permissions('radiology:read')
  @Get()
  findAll(@Query('status') status?: RadiologyOrderStatus, @Query('patientId') patientId?: string) {
    return this.radiologyService.findAll(status, patientId);
  }

  @Permissions('radiology:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.radiologyService.findOne(id);
  }

  @Permissions('radiology:create')
  @Post()
  create(@Body() dto: CreateRadiologyOrderDto) {
    return this.radiologyService.create(dto);
  }

  @Permissions('radiology:update')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateRadiologyOrderStatusDto) {
    return this.radiologyService.updateStatus(id, dto);
  }

  @Permissions('radiology:update')
  @Patch(':id/result')
  updateResult(@Param('id') id: string, @Body() dto: UpdateRadiologyResultDto, @Request() req: any) {
    return this.radiologyService.updateResult(id, dto, req.user?.fullName);
  }
}
