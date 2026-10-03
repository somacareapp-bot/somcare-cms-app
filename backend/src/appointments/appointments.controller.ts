import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AppointmentsService } from './appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { isDoctorScoped } from '../auth/utils/scope.util';
import { canTransition } from './appointment-transitions.util';
import { VisitsService } from '../visits/visits.service';

@Controller('appointments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AppointmentsController {
  constructor(
    private readonly service: AppointmentsService,
    private readonly visitsService: VisitsService,
  ) {}

  @Permissions('appointments:create')
  @Post()
  create(@Body() body: any, @Request() req: any) {
    return this.service.create({ ...body, createdBy: req.user.id });
  }

  @Permissions('appointments:read')
  @Get()
  findAll(
    @Request() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('date') date?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: string,
    @Query('doctorId') doctorId?: string,
    @Query('patientId') patientId?: string,
    @Query('search') search?: string,
  ) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.service.findAll(
      { page: Number(page), limit: Number(limit), date, dateFrom, dateTo, status, doctorId, patientId, search },
      scopeDoctorId,
    );
  }

  // Non-blocking pre-check called by NewAppointmentPage before submit —
  // returns a warning if the patient already has an active appointment or
  // visit for the same doctor/department, or null if it's clear to book.
  // Must stay above the ':id' route below so 'check-duplicate' doesn't get
  // swallowed as a param.
  @Permissions('appointments:read')
  @Get('check-duplicate')
  checkDuplicate(
    @Query('patientId') patientId: string,
    @Query('doctorId') doctorId?: string,
    @Query('department') department?: string,
  ) {
    return this.service.checkDuplicate(patientId, doctorId, department);
  }

  @Permissions('appointments:read')
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.service.findOne(id, scopeDoctorId);
  }

  @Permissions('appointments:update')
  @Put(':id')
  update(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.service.update(id, body, scopeDoctorId);
  }

  // Every status change is checked against APPOINTMENT_TRANSITIONS so a
  // role can only push the appointment through its own stage — a nurse
  // can't confirm, a receptionist can't start triage, a doctor can't
  // check patients in. Admin bypasses, same as PermissionsGuard.
  @Permissions('appointments:update')
  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    const current = await this.service.findOne(id, scopeDoctorId);

    if (!canTransition(current.status, status, req.user.roles ?? [])) {
      throw new ForbiddenException(
        `Your role cannot move an appointment from "${current.status}" to "${status}".`,
      );
    }

    const updated = await this.service.update(id, { status }, scopeDoctorId);

    // Hand-off point: checking a patient in creates the Visit that the
    // clinical Triage queue reads from. From here the appointment is
    // done — status flows through Visit/VisitStatus instead.
    if (status === 'waiting' && current.status !== 'waiting') {
      await this.visitsService.checkIn({
        patientId: current.patientId,
        appointmentId: current.id,
        doctorId: current.doctorId ?? undefined,
        department: current.department,
      });
    }

    return updated;
  }

  @Permissions('appointments:delete')
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    const scopeDoctorId = isDoctorScoped(req.user) ? req.user.id : undefined;
    return this.service.remove(id, scopeDoctorId);
  }
}
