import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VitalRange } from './entities/vital-range.entity';
import { DiagnosisCode } from './entities/diagnosis-code.entity';
import { VisitType } from './entities/visit-type.entity';
import { NoteTemplate } from './entities/note-template.entity';
import { ClinicalSettingsService } from './clinical-settings.service';
import { ClinicalSettingsController } from './clinical-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([VitalRange, DiagnosisCode, VisitType, NoteTemplate])],
  controllers: [ClinicalSettingsController],
  providers: [ClinicalSettingsService],
  exports: [ClinicalSettingsService],
})
export class ClinicalSettingsModule {}
