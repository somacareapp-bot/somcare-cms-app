import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { RadiologyOrder } from './radiology-order.entity';
import { RadiologyTestCatalog } from '../../settings/radiology/entities/radiology-test-catalog.entity';

// One row per selected imaging study on an order (no panel expansion — flat).
@Entity('radiology_order_items')
export class RadiologyOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'radiology_order_id' })
  radiologyOrderId: string;

  @ManyToOne(() => RadiologyOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'radiology_order_id' })
  radiologyOrder: RadiologyOrder;

  @Column({ name: 'test_catalog_id', nullable: true })
  testCatalogId: string | null;

  @ManyToOne(() => RadiologyTestCatalog, { nullable: true })
  @JoinColumn({ name: 'test_catalog_id' })
  testCatalog: RadiologyTestCatalog;

  @Column({ name: 'test_name' })
  testName: string;

  @Column({ nullable: true })
  category: string;

  // Price snapshot taken at order time — locks in what was charged even if
  // the catalog price changes before the scan happens.
  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: number;

  // Radiologist's findings/report for this specific study.
  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string | null;

  // Set once this study has been pulled into an invoice via Billing's
  // "Load Charges" — excludes it from getVisitSummary() so the same scan
  // can never be billed twice.
  @Column({ name: 'invoiced_at', type: 'timestamptz', nullable: true })
  invoicedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
