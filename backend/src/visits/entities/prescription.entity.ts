import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Visit } from './visit.entity';
import { Medicine } from '../../pharmacy/entities/medicine.entity';

export enum PrescriptionStatus {
  PENDING = 'pending',
  DISPENSED = 'dispensed',
  CANCELLED = 'cancelled',
}

@Entity('prescriptions')
export class Prescription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'visit_id' })
  visitId: string;

  @ManyToOne(() => Visit, (v) => v.prescriptions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visit_id' })
  visit: Visit;

  @Column({ name: 'drug_name' })
  drugName: string;

  @Column({ nullable: true })
  dose: string;

  @Column({ nullable: true })
  frequency: string;

  @Column({ nullable: true })
  duration: string;

  @Column({ name: 'medicine_id', nullable: true })
  medicineId: string;

  @ManyToOne(() => Medicine, { nullable: true })
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column({ type: 'int', nullable: true })
  quantity: number;

  @Column({ type: 'enum', enum: PrescriptionStatus, default: PrescriptionStatus.PENDING })
  status: PrescriptionStatus;

  @Column({ name: 'dispensed_at', type: 'timestamptz', nullable: true })
  dispensedAt: Date;

  // Name of the staff member who dispensed this prescription, captured
  // automatically from the authenticated user — not a free-text field.
  @Column({ name: 'dispensed_by_name', nullable: true })
  dispensedByName: string;

  // Price snapshot taken at the moment of dispense — same pattern as
  // SaleItem.unitPrice/subtotal for POS. Prevents historical revenue from
  // drifting if the medicine's sellPrice changes later. Nullable because
  // rows dispensed before this column existed have no snapshot; readers
  // fall back to quantity * medicine.sellPrice for those.
  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitPrice: number;

  @Column({ name: 'subtotal', type: 'decimal', precision: 10, scale: 2, nullable: true })
  subtotal: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
