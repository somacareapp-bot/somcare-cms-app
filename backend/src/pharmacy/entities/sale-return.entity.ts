import {
  Entity, Column, PrimaryGeneratedColumn, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { SaleItem } from './sale-item.entity';
import { Prescription } from '../../visits/entities/prescription.entity';
import { Medicine } from './medicine.entity';

export enum ReturnReason {
  WRONG_MEDICINE  = 'wrong_medicine',
  EXPIRED         = 'expired',
  DAMAGED         = 'damaged',
  PATIENT_REFUSED = 'patient_refused',
  OTHER           = 'other',
}

export enum ReturnType {
  POS = 'pos',
  RX  = 'rx',
}

@Entity('sale_returns')
export class SaleReturn {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'return_number', unique: true })
  returnNumber: string;

  @Column({ type: 'enum', enum: ReturnType, default: ReturnType.POS })
  type: ReturnType;

  // ----- POS returns -----
  @Column({ name: 'sale_id', nullable: true })
  saleId: string;

  @ManyToOne(() => Sale, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @Column({ name: 'sale_item_id', nullable: true })
  saleItemId: string;

  @ManyToOne(() => SaleItem, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_item_id' })
  saleItem: SaleItem;

  // ----- RX returns -----
  @Column({ name: 'prescription_id', nullable: true })
  prescriptionId: string;

  @ManyToOne(() => Prescription, { nullable: true, eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: Prescription;

  // ----- Common -----
  @Column({ name: 'medicine_id', nullable: true })
  medicineId: string;

  @ManyToOne(() => Medicine, { nullable: true, eager: true })
  @JoinColumn({ name: 'medicine_id' })
  medicine: Medicine;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ type: 'enum', enum: ReturnReason, default: ReturnReason.OTHER })
  reason: ReturnReason;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'refund_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  refundAmount: number;

  @Column({ name: 'processed_by', nullable: true })
  processedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
