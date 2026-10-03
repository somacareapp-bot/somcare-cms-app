import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { User } from '../../users/entities/user.entity';
import { Prescription } from './prescription.entity';

export enum VisitStatus {
  WAITING = 'waiting',
  IN_TRIAGE = 'in_triage',
  WITH_DOCTOR = 'with_doctor',
  READY_DISCHARGE = 'ready_discharge',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum VisitUrgency {
  NORMAL = 'normal',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

@Entity('visits')
export class Visit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human-readable visit number, e.g. VIS-2026-004521
  @Column({ name: 'visit_number', unique: true })
  visitNumber: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'appointment_id', nullable: true })
  appointmentId: string;

  @Column({ name: 'doctor_id', nullable: true })
  doctorId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'enum', enum: VisitStatus, default: VisitStatus.WAITING })
  status: VisitStatus;

  @Column({ type: 'enum', enum: VisitUrgency, default: VisitUrgency.NORMAL })
  urgency: VisitUrgency;

  // ----- Timeline timestamps -----
  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date;

  @Column({ name: 'triage_started_at', type: 'timestamptz', nullable: true })
  triageStartedAt: Date;

  @Column({ name: 'vitals_recorded_at', type: 'timestamptz', nullable: true })
  vitalsRecordedAt: Date;

  @Column({ name: 'consultation_started_at', type: 'timestamptz', nullable: true })
  consultationStartedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  // ----- Vitals -----
  @Column({ name: 'blood_pressure', nullable: true })
  bloodPressure: string;

  @Column({ name: 'heart_rate', nullable: true })
  heartRate: string;

  @Column({ nullable: true })
  temperature: string;

  @Column({ nullable: true })
  spo2: string;

  // ----- Consultation -----
  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string;

  @Column({ name: 'history_of_present_illness', type: 'text', nullable: true })
  historyOfPresentIllness: string;

  @Column({ name: 'examination_findings', type: 'text', nullable: true })
  examinationFindings: string;

  @Column({ nullable: true })
  diagnosis: string;

  @Column({ type: "jsonb", nullable: true })
  diagnosisCodes: Record<string, any>[] | null;

  @OneToMany(() => Prescription, (p) => p.visit, { cascade: true })
  prescriptions: Prescription[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
