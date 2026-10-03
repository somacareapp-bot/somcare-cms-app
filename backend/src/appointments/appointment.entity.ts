import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { User } from '../users/entities/user.entity';

@Entity('appointments')
export class Appointment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patientId' })
  patient: Patient;

  @Column({ type: 'date' })
  appointmentDate: string;

  @Column({ type: 'time' })
  appointmentTime: string;

  @Column({ default: 'scheduled' })
  status: string;

  @Column({ default: 'consultation' })
  type: string;

  @Column({ nullable: true })
  notes: string;

  @Column({ nullable: true })
  doctorId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'doctorId' })
  doctor: User;

  @Column({ nullable: true })
  department: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  fee: number;

  // Set once this appointment's fee has been pulled into an invoice via
  // Billing's "Load Charges" — excludes it from getVisitSummary() so the
  // same consultation fee can never be billed twice.
  @Column({ type: 'timestamptz', nullable: true })
  invoicedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
