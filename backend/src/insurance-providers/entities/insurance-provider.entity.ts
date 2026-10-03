import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum InsuranceProviderStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
}

@Entity('insurance_providers')
export class InsuranceProvider extends BaseEntity {
  @Column({ unique: true })
  name: string;

  // Free-text on purpose (e.g. "80%", "80% up to $500") — coverage terms vary
  // too much per provider/contract to model as a single numeric column yet.
  @Column({ nullable: true })
  coverage: string;

  @Column({ nullable: true })
  contact: string;

  @Column({
    type: 'enum',
    enum: InsuranceProviderStatus,
    default: InsuranceProviderStatus.ACTIVE,
  })
  status: InsuranceProviderStatus;
}
