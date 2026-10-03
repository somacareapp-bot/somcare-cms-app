import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { ExpenseCategoryGroup } from './expense-category-group.entity';

// Real, database-backed replacement for the old fixed ExpenseCategory enum.
// Expense.category (see expense.entity.ts) stores this row's `code` as a
// plain string — not a foreign key — so deactivating or editing a category
// later never breaks historical expenses that already reference the old code.
@Entity('expense_categories')
export class ExpenseCategory extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  label: string;

  @Column({ name: 'group_id' })
  groupId: string;

  @ManyToOne(() => ExpenseCategoryGroup, { eager: true })
  @JoinColumn({ name: 'group_id' })
  group: ExpenseCategoryGroup;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @Column({ default: true })
  active: boolean;
}
