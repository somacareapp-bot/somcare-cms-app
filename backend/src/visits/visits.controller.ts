import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { isDoctorScoped } from '../auth/utils/scope.util';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { UpdateVisitStatusDto } from './dto/update-visit-status.dto';
import { UpdateVitalsDto } from './dto/update-vitals.dto';
import { UpdateConsultationDto } from './dto/update-consultation.dto';
import { CreatePrescriptionDto } from './dto/create-prescription.dto';
import { VisitStatus } from './entities/visit.entity';


@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Permissions('queue:read', 'visits:read')
  @Get('queue')
  findQueue(@Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.findQueue(scopeDoctorId);
  }

  @Permissions('visits:read')
  @Get()
  findAll(
    @Query('status') status: VisitStatus | undefined,
    @Query('patientId') patientId: string | undefined,
    @Request() req: any,
  ) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.findAll(status, scopeDoctorId, patientId);
  }

  @Permissions('visits:read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.findOne(id, scopeDoctorId);
  }

  @Permissions('visits:create')
  @Post()
  checkIn(@Body() dto: CreateVisitDto) {
    return this.visitsService.checkIn(dto);
  }


  @Permissions('visits:update')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateVisitStatusDto, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.updateStatus(id, dto, scopeDoctorId);
  }

  @Permissions('visits:update')
  @Patch(':id/vitals')
  updateVitals(@Param('id') id: string, @Body() dto: UpdateVitalsDto, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.updateVitals(id, dto, scopeDoctorId);
  }

  @Permissions('consultations:update')
  @Patch(':id/consultation')
  updateConsultation(@Param('id') id: string, @Body() dto: UpdateConsultationDto, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.updateConsultation(id, dto, scopeDoctorId);
  }

  @Permissions('visits:update')
  @Patch(':id/complete')
  complete(@Param('id') id: string, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.complete(id, scopeDoctorId);
  }

  @Permissions('prescriptions:create')
  @Post(':id/prescriptions')
  addPrescription(@Param('id') id: string, @Body() dto: CreatePrescriptionDto, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;

    return this.visitsService.addPrescription(id, dto, scopeDoctorId);
  }

  @Permissions('prescriptions:delete')
  @Delete(':id/prescriptions/:prescriptionId')
  removePrescription(
    @Param('id') id: string,
    @Param('prescriptionId') prescriptionId: string,
    @Request() req: any,
  ) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.visitsService.removePrescription(id, prescriptionId, scopeDoctorId);
  }
}
