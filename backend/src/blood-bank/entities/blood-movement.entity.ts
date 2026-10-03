import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BloodGroup } from '../../patients/entities/patient.entity';

export enum BloodMovementType {
  ADD = 'add',
  ISSUE = 'issue',
  DONATION = 'donation',
}

@Entity('blood_inventory_movements')
export class BloodInventoryMovement extends BaseEntity {
  @Column({ name: 'blood_group', type: 'enum', enum: BloodGroup })
  bloodGroup: BloodGroup;

  @Column({ type: 'enum', enum: BloodMovementType })
  type: BloodMovementType;

  @Column({ type: 'int' })
  units: number;

  @Column({ nullable: true, type: 'text' })
  note: string;
}
