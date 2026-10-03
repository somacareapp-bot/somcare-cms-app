import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { LabTestSupplyItem } from './lab-test-supply-item.entity';

export enum LabTestCostMode {
  // Cost is derived from the test recipe (lab_test_supply_items). Default.
  AUTO = 'auto',
  // An administrator has pinned the cost; manualCostOverride wins.
  MANUAL = 'manual',
}

@Entity('lab_test_catalog')
export class LabTestCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  unit: string;

  @Column({ name: 'reference_range', nullable: true })
  referenceRange: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: true })
  active: boolean;

  // True for a bundle like CBC that expands into several component tests on order.
  @Column({ name: 'is_panel', default: false })
  isPanel: boolean;

  // Set on a component test to link it back to its parent panel (e.g. WBC -> CBC).
  @Column({ name: 'panel_id', nullable: true })
  panelId: string | null;

  @ManyToOne(() => LabTestCatalog, (t) => t.components, { nullable: true })
  @JoinColumn({ name: 'panel_id' })
  panel: LabTestCatalog;

  @OneToMany(() => LabTestCatalog, (t) => t.panel)
  components: LabTestCatalog[];

  // ----- Costing configuration -----

  @Column({
    name: 'cost_calculation_mode',
    type: 'enum',
    enum: LabTestCostMode,
    default: LabTestCostMode.AUTO,
  })
  costCalculationMode: LabTestCostMode;

  // Final cost to use when costCalculationMode = manual. Null falls back to the
  // auto cost, so a half-configured override can never zero out costing.
  @Column({ name: 'manual_cost_override', type: 'decimal', precision: 10, scale: 2, nullable: true })
  manualCostOverride: number | null;

  @Column({ name: 'manual_cost_reason', type: 'text', nullable: true })
  manualCostReason: string | null;

  // Test Recipe / BOM: the inventory items consumed by one run of this test.
  @OneToMany(() => LabTestSupplyItem, (c) => c.testCatalog)
  supplyItems: LabTestSupplyItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
