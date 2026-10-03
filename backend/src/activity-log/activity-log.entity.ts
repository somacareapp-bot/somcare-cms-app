import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../common/entities/base.entity';

/**
 * One row per notable staff action (login, create/update/delete, approve, etc.).
 * Feeds the monthly staff-activity report. createdAt comes from BaseEntity.
 */
@Entity('activity_logs')
export class ActivityLog extends BaseEntity {
  @Index()
  @Column({ name: 'user_id', type: 'varchar', nullable: true })
  userId: string | null;

  // Denormalised so the report doesn't need a join and survives user renames/deletes.
  @Column({ name: 'user_name', type: 'varchar', nullable: true })
  userName: string | null;

  @Column({ name: 'user_role', type: 'varchar', nullable: true })
  userRole: string | null;

  // e.g. 'login', 'create', 'update', 'delete', 'approve', 'dispense'
  @Index()
  @Column({ type: 'varchar' })
  action: string;

  // e.g. 'invoice', 'expense', 'patient', 'visit'
  @Column({ name: 'entity_type', type: 'varchar', nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', nullable: true })
  entityId: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ name: 'ip_address', type: 'varchar', nullable: true })
  ipAddress: string | null;
}
