import { Entity, Column, ManyToMany, JoinTable } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { Permission } from './permission.entity';

export enum RoleName {
  ADMINISTRATOR = 'administrator',
  MANAGER = 'manager',
  RECEPTIONIST = 'receptionist',
  NURSE = 'nurse',
  DOCTOR = 'doctor',
  PHARMACIST = 'pharmacist',
  LABORATORY = 'laboratory',
  RADIOLOGIST = 'radiologist',
  ACCOUNTANT = 'accountant',
  STOREKEEPER = 'storekeeper',
}

@Entity('roles')
export class Role extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  displayName: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: true })
  isActive: boolean;

  @ManyToMany(() => Permission, { eager: true })
  @JoinTable({
    name: 'role_permissions',
    joinColumn: { name: 'role_id' },
    inverseJoinColumn: { name: 'permission_id' },
  })
  permissions: Permission[];
}
