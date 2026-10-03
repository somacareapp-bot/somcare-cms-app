import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { numericTransformer } from '../numeric.transformer';

// Manual +/- corrections to a person's balance for one leave type and year.
@Entity('leave_adjustments')
export class LeaveAdjustment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  userId: string;

  @Column({ type: 'varchar' })
  leaveTypeId: string;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'decimal', precision: 6, scale: 2, transformer: numericTransformer })
  days: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdById: string | null;

  @Column({ type: 'varchar', nullable: true })
  createdByName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
