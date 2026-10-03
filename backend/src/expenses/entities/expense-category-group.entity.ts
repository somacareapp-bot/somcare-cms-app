import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('expense_category_groups')
export class ExpenseCategoryGroup extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  label: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;
}
