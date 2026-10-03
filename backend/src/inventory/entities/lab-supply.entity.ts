import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum LabSupplyCategory {
  REAGENT = 'reagent',
  CONSUMABLE = 'consumable',
  EQUIPMENT = 'equipment',
  PPE = 'ppe',
  OTHER = 'other',
  BLOOD_COLLECTION = 'blood_collection',
  SPECIMEN_CONTAINERS = 'specimen_containers',
  SPECIMEN_COLLECTION = 'specimen_collection',
  MICROSCOPY = 'microscopy',
  LABORATORY_SUPPLIES = 'laboratory_supplies',
  RAPID_TEST_KITS = 'rapid_test_kits',
  BIOCHEMISTRY = 'biochemistry',
  HEMATOLOGY = 'hematology',
  BLOOD_BANKING = 'blood_banking',
  QUALITY_CONTROL = 'quality_control',
  CLEANING_SUPPLIES = 'cleaning_supplies',
  WASTE_MANAGEMENT = 'waste_management',
}

@Entity('lab_supplies')
export class LabSupply extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'enum', enum: LabSupplyCategory, default: LabSupplyCategory.CONSUMABLE })
  category: LabSupplyCategory;

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
