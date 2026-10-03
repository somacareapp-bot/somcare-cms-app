import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VitalRange } from './entities/vital-range.entity';
import { DiagnosisCode } from './entities/diagnosis-code.entity';
import { VisitType } from './entities/visit-type.entity';
import { NoteTemplate } from './entities/note-template.entity';

// Starter data for a general facility. Editable afterward from each Settings panel —
// this only determines what's there the first time the table is empty.

const VITAL_RANGE_SEED: Partial<VitalRange>[] = [
  { vital: 'Blood Pressure (Systolic)', min: '90', max: '120', unit: 'mmHg' },
  { vital: 'Blood Pressure (Diastolic)', min: '60', max: '80', unit: 'mmHg' },
  { vital: 'Mean Arterial Pressure (MAP)', min: '70', max: '100', unit: 'mmHg' },
  { vital: 'Pulse Pressure', min: '30', max: '50', unit: 'mmHg' },
  { vital: 'Heart Rate (Pulse)', min: '60', max: '100', unit: 'bpm' },
  { vital: 'Respiratory Rate', min: '12', max: '20', unit: 'breaths/min' },
  { vital: 'Temperature (Oral)', min: '36.1', max: '37.2', unit: '°C' },
  { vital: 'SpO2 (Oxygen Saturation)', min: '95', max: '100', unit: '%' },
  { vital: 'Random Blood Glucose', min: '70', max: '140', unit: 'mg/dL' },
  { vital: 'Fasting Blood Glucose', min: '70', max: '100', unit: 'mg/dL' },
  { vital: 'Body Mass Index (BMI)', min: '18.5', max: '24.9', unit: 'kg/m²' },
  { vital: 'MUAC (Adult)', min: '23', max: '33', unit: 'cm' },
  { vital: 'Head Circumference (Newborn)', min: '32', max: '37', unit: 'cm' },
  { vital: 'Capillary Refill Time', min: '0', max: '2', unit: 'sec' },
  { vital: 'Pain Score', min: '0', max: '3', unit: '/10' },
];

const DIAGNOSIS_CODE_SEED: Partial<DiagnosisCode>[] = [
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory' },
  { code: 'J18.9', description: 'Pneumonia, unspecified organism', category: 'Respiratory' },
  { code: 'J45.909', description: 'Asthma, unspecified, uncomplicated', category: 'Respiratory' },
  { code: 'J20.9', description: 'Acute bronchitis, unspecified', category: 'Respiratory' },
  { code: 'A09', description: 'Infectious gastroenteritis and colitis, unspecified', category: 'Digestive' },
  { code: 'K29.70', description: 'Gastritis, unspecified, without bleeding', category: 'Digestive' },
  { code: 'K59.00', description: 'Constipation, unspecified', category: 'Digestive' },
  { code: 'K21.9', description: 'Gastro-esophageal reflux disease without esophagitis', category: 'Digestive' },
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', category: 'Endocrine' },
  { code: 'E03.9', description: 'Hypothyroidism, unspecified', category: 'Endocrine' },
  { code: 'E66.9', description: 'Obesity, unspecified', category: 'Endocrine' },
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular' },
  { code: 'I50.9', description: 'Heart failure, unspecified', category: 'Cardiovascular' },
  { code: 'I25.10', description: 'Atherosclerotic heart disease without angina pectoris', category: 'Cardiovascular' },
  { code: 'E78.5', description: 'Hyperlipidemia, unspecified', category: 'Cardiovascular' },
  { code: 'M54.5', description: 'Low back pain', category: 'Musculoskeletal' },
  { code: 'M25.50', description: 'Pain in unspecified joint', category: 'Musculoskeletal' },
  { code: 'M79.1', description: 'Myalgia', category: 'Musculoskeletal' },
  { code: 'M06.9', description: 'Rheumatoid arthritis, unspecified', category: 'Musculoskeletal' },
  { code: 'N39.0', description: 'Urinary tract infection, site not specified', category: 'Genitourinary' },
  { code: 'N30.90', description: 'Cystitis, unspecified, without hematuria', category: 'Genitourinary' },
  { code: 'N18.9', description: 'Chronic kidney disease, unspecified', category: 'Genitourinary' },
  { code: 'B54', description: 'Unspecified malaria', category: 'Infectious' },
  { code: 'A00.9', description: 'Cholera, unspecified', category: 'Infectious' },
  { code: 'A15.0', description: 'Tuberculosis of lung', category: 'Infectious' },
  { code: 'B20', description: 'HIV disease', category: 'Infectious' },
  { code: 'A90', description: 'Dengue fever', category: 'Infectious' },
  { code: 'Z34.90', description: 'Encounter for supervision of normal pregnancy, unspecified trimester', category: 'Obstetric' },
  { code: 'O26.9', description: 'Pregnancy-related condition, unspecified', category: 'Obstetric' },
  { code: 'O80', description: 'Encounter for full-term uncomplicated delivery', category: 'Obstetric' },
  { code: 'O21.9', description: 'Vomiting of pregnancy, unspecified', category: 'Obstetric' },
  { code: 'L30.9', description: 'Dermatitis, unspecified', category: 'Dermatological' },
  { code: 'L03.90', description: 'Cellulitis, unspecified', category: 'Dermatological' },
  { code: 'B86', description: 'Scabies', category: 'Dermatological' },
  { code: 'F32.9', description: 'Major depressive disorder, single episode, unspecified', category: 'Mental Health' },
  { code: 'F41.9', description: 'Anxiety disorder, unspecified', category: 'Mental Health' },
  { code: 'S01.90XA', description: 'Unspecified open wound of head, initial encounter', category: 'Injury' },
  { code: 'S52.90XA', description: 'Unspecified fracture of forearm, initial encounter', category: 'Injury' },
  { code: 'T14.90XA', description: 'Injury, unspecified, initial encounter', category: 'Injury' },
  { code: 'H10.9', description: 'Conjunctivitis, unspecified', category: 'Eye' },
  { code: 'H66.90', description: 'Otitis media, unspecified', category: 'ENT' },
  { code: 'J02.9', description: 'Acute pharyngitis, unspecified', category: 'ENT' },
  { code: 'P07.30', description: 'Preterm newborn, unspecified weeks of gestation', category: 'Pediatric' },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'General' },
  { code: 'R51', description: 'Headache', category: 'General' },
];

// Color must be one of the five options the Visit Types panel's select control offers
// (Blue, Green, Red, Purple, Orange) — anything else won't survive an edit round-trip.
const VISIT_TYPE_SEED: Partial<VisitType>[] = [
  { name: 'New Patient', duration: '30 min', color: 'Blue' },
  { name: 'Follow-up', duration: '15 min', color: 'Green' },
  { name: 'Emergency', duration: 'Immediate', color: 'Red' },
  { name: 'Referral', duration: '20 min', color: 'Purple' },
  { name: 'Antenatal Visit', duration: '30 min', color: 'Purple' },
  { name: 'Postnatal Visit', duration: '20 min', color: 'Purple' },
  { name: 'Well-Baby / Growth Monitoring', duration: '20 min', color: 'Green' },
  { name: 'Vaccination', duration: '10 min', color: 'Blue' },
  { name: 'Chronic Disease Follow-up', duration: '20 min', color: 'Orange' },
  { name: 'Minor Procedure', duration: '30 min', color: 'Orange' },
  { name: 'Telemedicine Consultation', duration: '15 min', color: 'Blue' },
  { name: 'Second Opinion', duration: '30 min', color: 'Green' },
];

const NOTE_TEMPLATE_SEED: Partial<NoteTemplate>[] = [
  { name: 'SOAP — General', specialty: 'General Medicine', lastUpdated: 'Just now' },
  { name: 'Antenatal Visit', specialty: 'Obstetrics', lastUpdated: 'Just now' },
  { name: 'Well-Child Check', specialty: 'Pediatrics', lastUpdated: 'Just now' },
  { name: 'Chronic Disease Follow-up', specialty: 'Internal Medicine', lastUpdated: 'Just now' },
  { name: 'Emergency Assessment', specialty: 'Emergency', lastUpdated: 'Just now' },
];

@Injectable()
export class ClinicalSettingsService {
  constructor(
    @InjectRepository(VitalRange) private readonly vitalRangesRepo: Repository<VitalRange>,
    @InjectRepository(DiagnosisCode) private readonly diagnosisCodesRepo: Repository<DiagnosisCode>,
    @InjectRepository(VisitType) private readonly visitTypesRepo: Repository<VisitType>,
    @InjectRepository(NoteTemplate) private readonly noteTemplatesRepo: Repository<NoteTemplate>,
  ) {}

  private async seedIfEmpty<T extends object>(repo: Repository<T>, seed: Partial<T>[]) {
    const count = await repo.count();
    if (count > 0) return { seeded: false, count };
    const rows = await repo.save(seed.map((s) => repo.create(s as any) as unknown as T));
    return { seeded: true, count: rows.length };
  }

  // ----- Vital Ranges -----
  async findAllVitalRanges() {
    await this.seedIfEmpty(this.vitalRangesRepo, VITAL_RANGE_SEED);
    return this.vitalRangesRepo.find({ order: { vital: 'ASC' } });
  }
  seedVitalRanges() {
    return this.seedIfEmpty(this.vitalRangesRepo, VITAL_RANGE_SEED);
  }
  createVitalRange(dto: Partial<VitalRange>) {
    return this.vitalRangesRepo.save(this.vitalRangesRepo.create(dto));
  }
  async updateVitalRange(id: string, dto: Partial<VitalRange>) {
    const row = await this.vitalRangesRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Vital range not found');
    Object.assign(row, dto);
    return this.vitalRangesRepo.save(row);
  }
  async removeVitalRange(id: string) {
    await this.vitalRangesRepo.delete(id);
    return { deleted: true };
  }

  // ----- Diagnosis Codes -----
  async findAllDiagnosisCodes() {
    await this.seedIfEmpty(this.diagnosisCodesRepo, DIAGNOSIS_CODE_SEED);
    return this.diagnosisCodesRepo.find({ order: { code: 'ASC' } });
  }
  seedDiagnosisCodes() {
    return this.seedIfEmpty(this.diagnosisCodesRepo, DIAGNOSIS_CODE_SEED);
  }
  createDiagnosisCode(dto: Partial<DiagnosisCode>) {
    return this.diagnosisCodesRepo.save(this.diagnosisCodesRepo.create(dto));
  }
  async updateDiagnosisCode(id: string, dto: Partial<DiagnosisCode>) {
    const row = await this.diagnosisCodesRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Diagnosis code not found');
    Object.assign(row, dto);
    return this.diagnosisCodesRepo.save(row);
  }
  async removeDiagnosisCode(id: string) {
    await this.diagnosisCodesRepo.delete(id);
    return { deleted: true };
  }

  // ----- Visit Types -----
  async findAllVisitTypes() {
    await this.seedIfEmpty(this.visitTypesRepo, VISIT_TYPE_SEED);
    return this.visitTypesRepo.find({ order: { name: 'ASC' } });
  }
  seedVisitTypes() {
    return this.seedIfEmpty(this.visitTypesRepo, VISIT_TYPE_SEED);
  }
  createVisitType(dto: Partial<VisitType>) {
    return this.visitTypesRepo.save(this.visitTypesRepo.create(dto));
  }
  async updateVisitType(id: string, dto: Partial<VisitType>) {
    const row = await this.visitTypesRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Visit type not found');
    Object.assign(row, dto);
    return this.visitTypesRepo.save(row);
  }
  async removeVisitType(id: string) {
    await this.visitTypesRepo.delete(id);
    return { deleted: true };
  }

  // ----- Note Templates -----
  async findAllNoteTemplates() {
    await this.seedIfEmpty(this.noteTemplatesRepo, NOTE_TEMPLATE_SEED);
    return this.noteTemplatesRepo.find({ order: { name: 'ASC' } });
  }
  seedNoteTemplates() {
    return this.seedIfEmpty(this.noteTemplatesRepo, NOTE_TEMPLATE_SEED);
  }
  createNoteTemplate(dto: Partial<NoteTemplate>) {
    return this.noteTemplatesRepo.save(this.noteTemplatesRepo.create({ ...dto, lastUpdated: 'Just now' }));
  }
  async updateNoteTemplate(id: string, dto: Partial<NoteTemplate>) {
    const row = await this.noteTemplatesRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Note template not found');
    Object.assign(row, dto, { lastUpdated: 'Just now' });
    return this.noteTemplatesRepo.save(row);
  }
  async removeNoteTemplate(id: string) {
    await this.noteTemplatesRepo.delete(id);
    return { deleted: true };
  }
}
