import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { LabSupply } from './lab-supply.entity';

export enum LabSupplyStockLogType {
  RESTOCK = 'restock',
  ISSUE = 'issue',
}

export enum LabSupplyStockLogReferenceType {
  LAB_ORDER = 'lab_order',
  MANUAL = 'manual',
}

@Entity('lab_supply_stock_logs')
export class LabSupplyStockLog extends BaseEntity {
  @Column({ name: 'lab_supply_id' })
  labSupplyId: string;

  @ManyToOne(() => LabSupply, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_supply_id' })
  labSupply: LabSupply;

  @Column({ type: 'enum', enum: LabSupplyStockLogType })
  type: LabSupplyStockLogType;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'previous_stock', type: 'int' })
  previousStock: number;

  @Column({ name: 'new_stock', type: 'int' })
  newStock: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  // ----- Provenance (added for automatic laboratory consumption) -----
  // Deliberately NOT a new enum member on `type`: altering a Postgres enum in place
  // is the one schema change TypeORM's synchronize handles badly. Automatic lab usage
  // is logged as ISSUE and identified by referenceType instead.

  @Column({ name: 'reference_type', type: 'varchar', nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'varchar', nullable: true })
  referenceId: string | null;

  // Human-readable pointer, e.g. LAB-2026-000021.
  @Column({ name: 'reference_number', type: 'varchar', nullable: true })
  referenceNumber: string | null;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitCost: number | null;

  @Column({ name: 'total_cost', type: 'decimal', precision: 12, scale: 2, nullable: true })
  totalCost: number | null;
}
