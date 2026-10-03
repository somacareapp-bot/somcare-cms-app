import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  PRESCRIPTION = 'prescription',
  APPOINTMENT = 'appointment',
  LAB_RESULT = 'lab_result',
  INVOICE = 'invoice',
  EXPENSE = 'expense',
  PURCHASE = 'purchase',
  SYSTEM = 'system',
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The user (staff account) this notification is FOR
  @Index()
  @Column()
  recipientId: string;

  // Who/what triggered it, e.g. "Dr. Ayaan Hassan"
  @Column({ nullable: true })
  actorName?: string;

  @Column({ nullable: true })
  actorAvatarUrl?: string;

  @Column({ type: 'enum', enum: NotificationType })
  type: NotificationType;

  // Short line, e.g. "sent a prescription to Pharmacy"
  @Column()
  message: string;

  // Deep-link reference, e.g. { patientId, prescriptionId }
  @Column({ type: 'json', nullable: true })
  meta?: Record<string, any>;

  // Where clicking the notification should navigate to
  @Column({ nullable: true })
  link?: string;

  @Index()
  @Column({ default: false })
  read: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
