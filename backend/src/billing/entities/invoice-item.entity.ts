import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Invoice } from './invoice.entity';

// Matches the P&L report's Revenue / Income section line items.
export enum RevenueCategory {
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  PHARMACY = 'pharmacy',
  RADIOLOGY = 'radiology',
  REGISTRATION = 'registration',
  EMERGENCY = 'emergency',
  PROCEDURE = 'procedure',
  SURGERY = 'surgery',
  ADMISSION = 'admission',
  BED_CHARGES = 'bed_charges',
  WARD_CHARGES = 'ward_charges',
  PRIVATE_ROOM = 'private_room',
  ICU = 'icu',
  NICU = 'nicu',
  MATERNITY = 'maternity',
  DELIVERY = 'delivery',
  CAESAREAN = 'caesarean',
  ANTENATAL = 'antenatal',
  POSTNATAL = 'postnatal',
  FAMILY_PLANNING = 'family_planning',
  PEDIATRIC = 'pediatric',
  DENTAL = 'dental',
  PHYSIOTHERAPY = 'physiotherapy',
  REHABILITATION = 'rehabilitation',
  AMBULANCE = 'ambulance',
  HOME_CARE = 'home_care',
  NURSING = 'nursing',
  DRESSING = 'dressing',
  INJECTION = 'injection',
  IV_THERAPY = 'iv_therapy',
  BLOOD_BANK = 'blood_bank',
  BLOOD_TRANSFUSION = 'blood_transfusion',
  OPERATING_THEATRE = 'operating_theatre',
  ANESTHESIA = 'anesthesia',
  ENDOSCOPY = 'endoscopy',
  MINOR_SURGERY = 'minor_surgery',
  MAJOR_SURGERY = 'major_surgery',
  ORTHOPEDIC = 'orthopedic',
  CARDIOLOGY = 'cardiology',
  DERMATOLOGY = 'dermatology',
  OPHTHALMOLOGY = 'ophthalmology',
  ENT = 'ent',
  GYNECOLOGY = 'gynecology',
  NEUROLOGY = 'neurology',
  MENTAL_HEALTH = 'mental_health',
  NUTRITION = 'nutrition',
  COUNSELING = 'counseling',
  HEALTH_SCREENING = 'health_screening',
  MEDICAL_CHECKUP = 'medical_checkup',
  OCCUPATIONAL_HEALTH = 'occupational_health',
  PRE_EMPLOYMENT = 'pre_employment',
  CERTIFICATES = 'certificates',
  MEDICAL_REPORTS = 'medical_reports',
  PATIENT_CARD = 'patient_card',
  MEDICAL_RECORDS = 'medical_records',
  VACCINATION = 'vaccination',
  IMMUNIZATION = 'immunization',
  INSURANCE_CLAIMS = 'insurance_claims',
  CORPORATE_HEALTH = 'corporate_health',
  SCHOOL_HEALTH = 'school_health',
  TRAVEL_MEDICAL = 'travel_medical',
  VISA_MEDICAL = 'visa_medical',
  HOME_NURSING = 'home_nursing',
  SPECIALIST = 'specialist',
  FOLLOWUP = 'followup',
  HEALTH_EDUCATION = 'health_education',
  EQUIPMENT_RENTAL = 'equipment_rental',
  ROOM_SERVICE = 'room_service',
  OTHER_CLINICAL = 'other_clinical',
  OTHER = 'other',
}

@Entity('invoice_items')
export class InvoiceItem extends BaseEntity {
  @Column()
  description: string;

  @Column({
    name: 'revenue_category',
    type: 'enum',
    enum: RevenueCategory,
    default: RevenueCategory.OTHER,
  })
  revenueCategory: RevenueCategory;

  @Column({ type: 'int', default: 1 })

  qty: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;
}
