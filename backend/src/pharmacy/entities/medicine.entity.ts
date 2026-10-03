import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum MedicineCategory {
  TABLET = 'tablet',
  CAPSULE = 'capsule',
  SYRUP = 'syrup',
  INJECTION = 'injection',
  OINTMENT = 'ointment',
  DROPS = 'drops',
  OTHER = 'other',
}

@Entity('medicines')
export class Medicine extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ name: 'generic_name', nullable: true })
  genericName: string;

  @Column({ type: 'enum', enum: MedicineCategory, default: MedicineCategory.TABLET })
  category: MedicineCategory;

  @Column({ default: 'unit' })
  unit: string;

  @Column({ name: 'stock_quantity', type: 'int', default: 0 })
  stockQuantity: number;

  @Column({ name: 'reorder_level', type: 'int', default: 10 })
  reorderLevel: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  costPrice: number;

  @Column({ name: 'sell_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellPrice: number;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
