import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabOrder } from './lab-order.entity';
import { LabTestCatalog } from '../../settings/laboratory/entities/lab-test-catalog.entity';

/**
 * One row per *billable* test on a completed lab order.
 *
 * This is deliberately not the same grain as LabOrderItem. Ordering CBC creates ~8
 * LabOrderItem rows (one per analyte) but is a single $7.00 charge with a single
 * recipe, so summing item prices would badly overstate revenue. LaboratoryService
 * collapses panel components back to their parent panel before writing charges.
 *
 * Values are snapshots taken at completion — later edits to catalog prices or to the
 * recipe must not retroactively change what a finished order earned.
 */
@Entity('lab_order_charges')
export class LabOrderCharge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lab_order_id' })
  labOrderId: string;

  @ManyToOne(() => LabOrder, (o) => o.charges, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lab_order_id' })
  labOrder: LabOrder;

  @Column({ name: 'test_catalog_id', nullable: true })
  testCatalogId: string | null;

  @ManyToOne(() => LabTestCatalog, { nullable: true })
  @JoinColumn({ name: 'test_catalog_id' })
  testCatalog: LabTestCatalog;

  @Column({ name: 'test_name' })
  testName: string;

  @Column({ nullable: true })
  category: string;

  @Column({ type: 'int', default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  revenue: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  cost: number;

  @Column({ name: 'gross_profit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossProfit: number;

  // 'auto' | 'manual' — how unitCost was arrived at, kept for audit.
  @Column({ name: 'cost_mode', nullable: true })
  costMode: string;

  // False when the test had no recipe configured, so cost is $0 by absence rather
  // than by calculation. Lets reports flag unconfigured services instead of
  // reporting a flattering 100% margin.
  @Column({ name: 'has_recipe', default: false })
  hasRecipe: boolean;

  // Set when the parent order is cancelled after being costed. The row is kept
  // (not deleted) for audit — what was charged before cancellation stays visible —
  // but revenue/reporting queries must filter voidedAt IS NULL so a cancelled
  // order's charges never count as real revenue. Written by
  // LaboratoryService.reverseConsumption(), in the same transaction as the stock
  // restock, so a charge can never be voided without its stock also being restored.
  @Column({ name: 'voided_at', type: 'timestamptz', nullable: true })
  voidedAt: Date | null;

  // Set once this charge has been pulled into an invoice via Billing's
  // "Load Charges" — excludes it from getVisitSummary() so the same test
  // can never be billed twice. Independent of voidedAt.
  @Column({ name: 'invoiced_at', type: 'timestamptz', nullable: true })
  invoicedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
