import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RevenueCategory } from './invoice-item.entity';

// Catalog of billable services that aren't already covered by the Lab Test
// Catalog or the Medicine/Pharmacy catalog — e.g. Consultation, Procedures,
// Registration, and anything else. Feeds the searchable service picker on
// Create Invoice, alongside lab tests and medicines.
@Entity('services')
export class Service extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({
    name: 'revenue_category',
    type: 'enum',
    enum: RevenueCategory,
    default: RevenueCategory.OTHER,
  })
  revenueCategory: RevenueCategory;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
