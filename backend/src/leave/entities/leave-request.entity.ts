import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { LeaveType } from './leave-type.entity';
import { numericTransformer } from '../numeric.transformer';

export enum LeaveStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('leave_requests')
export class LeaveRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  userName: string;

  @Column({ type: 'uuid' })
  leaveTypeId: string;

  @ManyToOne(() => LeaveType, { eager: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'leaveTypeId' })
  leaveType: LeaveType;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date' })
  endDate: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, transformer: numericTransformer })
  days: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'enum', enum: LeaveStatus, default: LeaveStatus.PENDING })
  status: LeaveStatus;

  // Who should review it (resolved from the org chart). Null = admin handles it.
  @Column({ type: 'varchar', nullable: true })
  approverId: string | null;

  @Column({ type: 'varchar', nullable: true })
  approverName: string | null;

  @Column({ type: 'varchar', nullable: true })
  decidedById: string | null;

  @Column({ type: 'varchar', nullable: true })
  decidedByName: string | null;

  @Column({ type: 'text', nullable: true })
  decisionNote: string | null;

  @Column({ type: 'timestamp', nullable: true })
  decidedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
