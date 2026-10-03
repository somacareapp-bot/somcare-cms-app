import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { LabSupplyPurchase } from './lab-supply-purchase.entity';
import { LabSupply } from './lab-supply.entity';

@Entity('lab_supply_purchase_items')
export class LabSupplyPurchaseItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_id' })
  purchaseId: string;

  @ManyToOne(() => LabSupplyPurchase, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_id' })
  purchase: LabSupplyPurchase;

  @Column({ name: 'lab_supply_id' })
  labSupplyId: string;

  @ManyToOne(() => LabSupply)
  @JoinColumn({ name: 'lab_supply_id' })
  labSupply: LabSupply;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'cost_price', type: 'decimal', precision: 10, scale: 2 })
  costPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: number;
}
