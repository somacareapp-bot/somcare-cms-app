import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Patient } from '../../patients/entities/patient.entity';
import { Visit } from '../../visits/entities/visit.entity';
import { LabOrderItem } from './lab-order-item.entity';
import { LabOrderCharge } from './lab-order-charge.entity';

export enum LabOrderStatus {
  ORDERED = 'ordered',
  SAMPLE_COLLECTED = 'sample_collected',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

@Entity('lab_orders')
export class LabOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Human-readable lab order number, e.g. LAB-2026-000521
  @Column({ name: 'lab_order_number', unique: true })
  labOrderNumber: string;

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

  // Joined display name of the top-level tests selected (e.g. "CBC, Blood Glucose").
  // Kept for list views; structured per-test data lives on `items`.
  @Column({ name: 'test_name' })
  testName: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'enum', enum: LabOrderStatus, default: LabOrderStatus.ORDERED })
  status: LabOrderStatus;

  // Legacy free-text result field, kept only so pre-existing completed orders still display.
  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string;

  // Name of the staff member who entered/verified the results, captured
  // automatically from the authenticated user at the moment of verification.
  @Column({ name: 'verified_by_name', nullable: true })
  verifiedByName: string;

  @OneToMany(() => LabOrderItem, (item) => item.labOrder, { cascade: true })
  items: LabOrderItem[];

  // Per-billable-test revenue/cost snapshot, written once on completion.
  @OneToMany(() => LabOrderCharge, (charge) => charge.labOrder)
  charges: LabOrderCharge[];

  // ----- Costing snapshot (set at completion, inside the deduction transaction) -----
  // Nullable rather than defaulted so pre-existing completed orders read as
  // "never costed" instead of "earned $0".

  @Column({ name: 'total_revenue', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalRevenue: number | null;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalCost: number | null;

  @Column({ name: 'gross_profit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  grossProfit: number | null;

  @Column({ name: 'costed_at', type: 'timestamptz', nullable: true })
  costedAt: Date | null;

  @Column({ name: 'ordered_at', type: 'timestamptz', nullable: true })
  orderedAt: Date;

  @Column({ name: 'sample_collected_at', type: 'timestamptz', nullable: true })
  sampleCollectedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
