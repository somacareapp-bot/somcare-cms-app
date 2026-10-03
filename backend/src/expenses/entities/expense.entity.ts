import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ExpenseStatus {
  PENDING = 'pending',                             // just submitted, awaiting department head
  DEPT_HEAD_APPROVED = 'dept_head_approved',        // dept head approved (or auto-skipped) — awaiting admin approval
  DEPT_HEAD_REJECTED = 'dept_head_rejected',        // dept head rejected outright
  APPROVED = 'approved',                            // admin approved — awaiting payment
  REJECTED = 'rejected',                            // admin rejected outright
  PAID = 'paid',                                    // accountant marked as paid — final state
}

@Entity('expenses')
export class Expense extends BaseEntity {
  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  // Stores the `code` of a row in expense_categories (see
  // expense-category.entity.ts) — plain string, not a DB enum or FK, so
  // deactivating/renaming a category later never breaks historical rows.
  @Column({ default: 'other' })
  category: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true, name: 'receipt_url' })
  receiptUrl: string;

  @Column({ type: 'enum', enum: ExpenseStatus, default: ExpenseStatus.PENDING })
  status: ExpenseStatus;

  // Staff who submitted the expense
  @Column({ name: 'submitted_by_id' })
  submittedById: string;

  @Column({ name: 'submitted_by_name' })
  submittedByName: string;

  // Department-head stage (stage 1) — runs before admin approval.
  // Auto-skipped (status jumps straight to DEPT_HEAD_APPROVED, these fields
  // stay null, deptHeadAutoSkipped = true) when the submitter has no
  // department or that department has no head assigned.
  @Column({ name: 'dept_head_approved_by_id', nullable: true })
  deptHeadApprovedById: string;

  @Column({ name: 'dept_head_approved_by_name', nullable: true })
  deptHeadApprovedByName: string;

  @Column({ name: 'dept_head_approved_at', type: 'timestamp', nullable: true })
  deptHeadApprovedAt: Date;

  @Column({ name: 'dept_head_notes', type: 'text', nullable: true })
  deptHeadNotes: string;

  @Column({ name: 'dept_head_auto_skipped', type: 'boolean', default: false })
  deptHeadAutoSkipped: boolean;

  // Admin approval stage (stage 2, final approve/reject)
  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;

  @Column({ name: 'approved_by_name', nullable: true })
  approvedByName: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;

  // Payment stage (stage 3) — accountant (or admin) marks an approved
  // expense as paid. Final state.
  @Column({ name: 'paid_by_id', nullable: true })
  paidById: string;

  @Column({ name: 'paid_by_name', nullable: true })
  paidByName: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt: Date;

  @Column({ name: 'paid_notes', type: 'text', nullable: true })
  paidNotes: string;
}
