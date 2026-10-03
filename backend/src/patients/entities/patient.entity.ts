import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum Gender { MALE = 'male', FEMALE = 'female', OTHER = 'other' }
export enum BloodGroup { A_POS = 'A+', A_NEG = 'A-', B_POS = 'B+', B_NEG = 'B-', AB_POS = 'AB+', AB_NEG = 'AB-', O_POS = 'O+', O_NEG = 'O-', UNKNOWN = 'unknown' }
export enum PatientType { OUTPATIENT = 'outpatient', INPATIENT = 'inpatient', EMERGENCY = 'emergency' }
export enum PatientStatus { ACTIVE = 'active', INACTIVE = 'inactive', DECEASED = 'deceased' }

@Entity('patients')
export class Patient extends BaseEntity {
  // Auto-generated human-readable ID
  @Column({ name: 'patient_number', unique: true })
  patientNumber: string; // PT-2026-000001

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'middle_name', nullable: true })
  middleName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  phone: string;

  @Column({ name: 'alternative_phone', nullable: true })
  alternativePhone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  district: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ nullable: true })
  nationality: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  @Column({ name: 'blood_group', type: 'enum', enum: BloodGroup, default: BloodGroup.UNKNOWN })
  bloodGroup: BloodGroup;

  @Column({ nullable: true })
  allergies: string;

  @Column({ name: 'insurance_company', nullable: true })
  insuranceCompany: string;

  @Column({ name: 'insurance_number', nullable: true })
  insuranceNumber: string;

  @Column({ name: 'patient_type', type: 'enum', enum: PatientType, default: PatientType.OUTPATIENT })
  patientType: PatientType;

  @Column({ name: 'patient_status', type: 'enum', enum: PatientStatus, default: PatientStatus.ACTIVE })
  patientStatus: PatientStatus;

  @Column({ name: 'profile_photo', nullable: true })
  profilePhoto: string;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ name: 'registration_date', type: 'date' })
  registrationDate: Date;

  get fullName(): string {
    return [this.firstName, this.middleName, this.lastName].filter(Boolean).join(' ');
  }
}
