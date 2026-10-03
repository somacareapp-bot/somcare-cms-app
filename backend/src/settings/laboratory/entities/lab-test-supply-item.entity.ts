import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { LabTestCatalog } from './lab-test-catalog.entity';
import { LabSupply } from '../../../inventory/entities/lab-supply.entity';

/**
 * Test Recipe / Bill of Materials.
 *
 * One row per inventory item consumed by one run of a lab test. The test cost is
 * the sum of (quantityPerTest x wastage multiplier x supply.costPrice) across all rows.
 *
 * Attach the recipe to the *billable* test — i.e. to the panel row (CBC), not to the
 * individual component rows (WBC, RBC, ...). LaboratoryService resolves a component
 * item back to its parent panel when costing an order.
 */
@Entity('lab_test_supply_items')
@Unique('uq_lab_test_supply_item', ['testCatalogId', 'labSupplyId'])
export class LabTestSupplyItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'test_catalog_id' })
  testCatalogId: string;

  @ManyToOne(() => LabTestCatalog, (t) => t.supplyItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'test_catalog_id' })
  testCatalog: LabTestCatalog;

  @Column({ name: 'lab_supply_id' })
  labSupplyId: string;

  @ManyToOne(() => LabSupply, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'lab_supply_id' })
  labSupply: LabSupply;

  // Whole units only: lab_supplies.stock_quantity is an int column, so a fractional
  // quantity here could never be deducted faithfully. Model sub-unit consumption by
  // pricing the supply per consumed unit at purchase time instead.
  @Column({ name: 'quantity_per_test', type: 'int', default: 1 })
  quantityPerTest: number;

  // Optional wastage allowance. Applied to COST ONLY — stock is deducted in whole
  // units (quantityPerTest), so wastage never produces a fractional stock movement.
  @Column({ name: 'wastage_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  wastagePercent: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
