import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Ward } from './ward.entity';
import { Patient } from '../../patients/entities/patient.entity';

export enum BedStatus {
  AVAILABLE = 'Available',
  OCCUPIED = 'Occupied',
  MAINTENANCE = 'Maintenance',
}

@Entity('beds')
export class Bed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'bed_number' })
  bedNumber: string;

  @Column({ name: 'ward_id' })
  wardId: string;

  @ManyToOne(() => Ward, (ward) => ward.beds, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ward_id' })
  ward: Ward;

  @Column()
  floor: number;

  @Column({ name: 'daily_rate', type: 'decimal', precision: 10, scale: 2 })
  dailyRate: number;

  @Column({ type: 'enum', enum: BedStatus, default: BedStatus.AVAILABLE })
  status: BedStatus;

  @Column({ name: 'patient_id', nullable: true })
  patientId: string | null;

  @ManyToOne(() => Patient, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient | null;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
