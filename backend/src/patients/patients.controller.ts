import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { PatientsService } from './patients.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { UpdatePatientDto } from './dto/update-patient.dto';
import { QueryPatientDto } from './dto/query-patient.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
export class PatientsController {
  constructor(private readonly patientsService: PatientsService) {}

  @Permissions('patients:read')
  @Get()
  findAll(@Query() query: QueryPatientDto) {
    return this.patientsService.findAll(query);
  }

  @Permissions('patients:read')
  @Get('search')
  search(@Query('q') q: string) {
    return this.patientsService.search(q);
  }


  @Permissions('patients:read')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.patientsService.findOne(id);
  }

  @Permissions('patients:create')
  @Post()
  create(@Body() dto: CreatePatientDto, @Req() req: AuthenticatedRequest) {
    return this.patientsService.create(dto, req.user.id);
  }

  @Permissions('patients:update')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePatientDto, @Req() req: AuthenticatedRequest) {
    return this.patientsService.update(id, dto, req.user.id);
  }

  @Permissions('patients:delete')
  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.patientsService.remove(id, req.user.id);
  }
}
