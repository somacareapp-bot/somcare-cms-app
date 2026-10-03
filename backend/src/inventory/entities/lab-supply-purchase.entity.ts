import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { LabSupplyPurchaseItem } from './lab-supply-purchase-item.entity';

export enum LabSupplyPurchaseStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
}

export enum LabSupplyPurchaseApprovalStatus {
  SUBMITTED = 'submitted',                   // just created by lab technician — awaiting department head
  DEPT_HEAD_APPROVED = 'dept_head_approved', // dept head approved (or auto-skipped) — awaiting admin review
  DEPT_HEAD_REJECTED = 'dept_head_rejected', // dept head rejected outright
  ADMIN_APPROVED = 'admin_approved',         // administrator approved
  ADMIN_REJECTED = 'admin_rejected',         // administrator rejected
  PAID = 'paid',                             // accountant closed it out (balance is $0)
}

@Entity('lab_supply_purchases')
export class LabSupplyPurchase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_number', unique: true })
  purchaseNumber: string;

  @Column({ name: 'supplier_name' })
  supplierName: string;

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @Column({ name: 'attachment_url', type: 'text', nullable: true })
  attachmentUrl: string;

  @Column({ type: 'enum', enum: LabSupplyPurchaseStatus, default: LabSupplyPurchaseStatus.PENDING })
  status: LabSupplyPurchaseStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'paid_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  paidAmount: number;

  @OneToMany(() => LabSupplyPurchaseItem, (i) => i.purchase, { cascade: true, eager: true })
  items: LabSupplyPurchaseItem[];

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ----- Approval workflow: Submitted -> Dept Head -> Admin Review -> Accountant Paid -----
  @Column({ type: 'enum', enum: LabSupplyPurchaseApprovalStatus, default: LabSupplyPurchaseApprovalStatus.SUBMITTED, name: 'approval_status' })
  approvalStatus: LabSupplyPurchaseApprovalStatus;

  @Column({ name: 'submitted_by_id', nullable: true })
  submittedById: string;

  @Column({ name: 'submitted_by_name', nullable: true })
  submittedByName: string;

  // Department-head stage — auto-skipped (status jumps straight to
  // DEPT_HEAD_APPROVED, these fields stay null, deptHeadAutoSkipped = true)
  // when the submitter has no department or that department has no head.
  @Column({ name: 'dept_head_approved_by_id', nullable: true })
  deptHeadApprovedById: string;

  @Column({ name: 'dept_head_approved_by_name', nullable: true })
  deptHeadApprovedByName: string;

  @Column({ name: 'dept_head_approved_at', type: 'timestamptz', nullable: true })
  deptHeadApprovedAt: Date;

  @Column({ name: 'dept_head_notes', type: 'text', nullable: true })
  deptHeadNotes: string;

  @Column({ name: 'dept_head_auto_skipped', type: 'boolean', default: false })
  deptHeadAutoSkipped: boolean;

  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @Column({ name: 'reviewed_by_name', nullable: true })
  reviewedByName: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'paid_by_id', nullable: true })
  paidById: string;

  @Column({ name: 'paid_by_name', nullable: true })
  paidByName: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;
}
