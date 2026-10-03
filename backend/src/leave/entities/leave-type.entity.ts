import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { numericTransformer } from '../numeric.transformer';

@Entity('leave_types')
export class LeaveType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Days earned each month (e.g. 2.00). Ignored when isUnlimited.
  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, transformer: numericTransformer })
  accrualPerMonth: number;

  // Optional yearly cap on accrual.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  maxDaysPerYear: number | null;

  // Optional cap on the length of a single request.
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, transformer: numericTransformer })
  maxDaysPerRequest: number | null;

  @Column({ type: 'boolean', default: true })
  isPaid: boolean;

  // No balance tracking (e.g. unpaid, maternity) — requests are never blocked by balance.
  @Column({ type: 'boolean', default: false })
  isUnlimited: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', default: '#3b82f6' })
  color: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
