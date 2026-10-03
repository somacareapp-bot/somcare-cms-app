import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClinicalSettingsService } from './clinical-settings.service';

@UseGuards(JwtAuthGuard)
@Controller('settings/clinical')
export class ClinicalSettingsController {
  constructor(private readonly service: ClinicalSettingsService) {}

  // Vital Ranges
  @Get('vital-ranges')
  findVitalRanges() {
    return this.service.findAllVitalRanges();
  }
  @Post('vital-ranges/seed')
  seedVitalRanges() {
    return this.service.seedVitalRanges();
  }
  @Post('vital-ranges')
  createVitalRange(@Body() body: any) {
    return this.service.createVitalRange(body);
  }
  @Patch('vital-ranges/:id')
  updateVitalRange(@Param('id') id: string, @Body() body: any) {
    return this.service.updateVitalRange(id, body);
  }
  @Delete('vital-ranges/:id')
  removeVitalRange(@Param('id') id: string) {
    return this.service.removeVitalRange(id);
  }

  // Diagnosis Codes
  @Get('diagnosis-codes')
  findDiagnosisCodes() {
    return this.service.findAllDiagnosisCodes();
  }
  @Post('diagnosis-codes/seed')
  seedDiagnosisCodes() {
    return this.service.seedDiagnosisCodes();
  }
  @Post('diagnosis-codes')
  createDiagnosisCode(@Body() body: any) {
    return this.service.createDiagnosisCode(body);
  }
  @Patch('diagnosis-codes/:id')
  updateDiagnosisCode(@Param('id') id: string, @Body() body: any) {
    return this.service.updateDiagnosisCode(id, body);
  }
  @Delete('diagnosis-codes/:id')
  removeDiagnosisCode(@Param('id') id: string) {
    return this.service.removeDiagnosisCode(id);
  }

  // Visit Types
  @Get('visit-types')
  findVisitTypes() {
    return this.service.findAllVisitTypes();
  }
  @Post('visit-types/seed')
  seedVisitTypes() {
    return this.service.seedVisitTypes();
  }
  @Post('visit-types')
  createVisitType(@Body() body: any) {
    return this.service.createVisitType(body);
  }
  @Patch('visit-types/:id')
  updateVisitType(@Param('id') id: string, @Body() body: any) {
    return this.service.updateVisitType(id, body);
  }
  @Delete('visit-types/:id')
  removeVisitType(@Param('id') id: string) {
    return this.service.removeVisitType(id);
  }

  // Note Templates
  @Get('note-templates')
  findNoteTemplates() {
    return this.service.findAllNoteTemplates();
  }
  @Post('note-templates/seed')
  seedNoteTemplates() {
    return this.service.seedNoteTemplates();
  }
  @Post('note-templates')
  createNoteTemplate(@Body() body: any) {
    return this.service.createNoteTemplate(body);
  }
  @Patch('note-templates/:id')
  updateNoteTemplate(@Param('id') id: string, @Body() body: any) {
    return this.service.updateNoteTemplate(id, body);
  }
  @Delete('note-templates/:id')
  removeNoteTemplate(@Param('id') id: string) {
    return this.service.removeNoteTemplate(id);
  }
}
