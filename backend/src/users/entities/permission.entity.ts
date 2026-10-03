import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('permissions')
export class Permission extends BaseEntity {
  @Column({ unique: true })
  name: string; // e.g. 'patients:read', 'patients:create'

  @Column()
  module: string; // e.g. 'patients', 'billing'

  @Column()
  action: string; // e.g. 'read', 'create', 'update', 'delete'

  @Column({ nullable: true })
  description: string;
}
