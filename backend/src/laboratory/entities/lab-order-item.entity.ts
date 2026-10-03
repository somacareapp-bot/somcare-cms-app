import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LabOrder } from './lab-order.entity';
import { LabTestCatalog } from '../../settings/laboratory/entities/lab-test-catalog.entity';

export enum LabResultFlag {
  LOW = 'low',
  HIGH = 'high',
  NORMAL = 'normal',
}

// One row per individual test within a lab order (e.g. CBC expands into 8 of these).
@Entity('lab_order_items')
export class LabOrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'lab_order_id' })
  labOrderId: string;

  @ManyToOne(() => LabOrder, (order) => order.items, { onDelete: 'CASCADE' })
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

  @Column({ nullable: true })
  unit: string;

  @Column({ name: 'reference_range', nullable: true })
  referenceRange: string;

  @Column({ name: 'result_value', nullable: true })
  resultValue: string;

  @Column({ type: 'enum', enum: LabResultFlag, nullable: true })
  flag: LabResultFlag | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
