import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Visit } from '../../visits/entities/visit.entity';
import { RadiologyOrderItem } from './radiology-order-item.entity';

export enum RadiologyOrderStatus {
  ORDERED = 'ordered',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('radiology_orders')
export class RadiologyOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // e.g. RAD-2026-000042
  @Column({ name: 'radiology_order_number', unique: true })
  radiologyOrderNumber: string;

  @Column({ name: 'visit_id' })
  visitId: string;

  @ManyToOne(() => Visit)
  @JoinColumn({ name: 'visit_id' })
  visit: Visit;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  // Joined display name of the selected studies (e.g. "Chest X-Ray, Renal Scan").
  @Column({ name: 'test_name' })
  testName: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'enum', enum: RadiologyOrderStatus, default: RadiologyOrderStatus.ORDERED })
  status: RadiologyOrderStatus;

  // Name of the staff member who verified/completed the report.
  @Column({ name: 'verified_by_name', nullable: true })
  verifiedByName: string;

  @OneToMany(() => RadiologyOrderItem, (item) => item.radiologyOrder, { cascade: true })
  items: RadiologyOrderItem[];

  // Revenue is recognized at COMPLETED, not at order time — an order that
  // never gets scanned (e.g. cancelled) shouldn't have counted as revenue.
  // Nullable so an uncosted order reads as "never happened" rather than "$0".
  @Column({ name: 'total_revenue', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalRevenue: number | null;

  @Column({ name: 'costed_at', type: 'timestamptz', nullable: true })
  costedAt: Date | null;

  @Column({ name: 'ordered_at', type: 'timestamptz', nullable: true })
  orderedAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
