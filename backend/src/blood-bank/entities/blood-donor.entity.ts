import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { BloodGroup } from '../../patients/entities/patient.entity';

@Entity('blood_donors')
export class BloodDonor extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'blood_group', type: 'enum', enum: BloodGroup })
  bloodGroup: BloodGroup;

  @Column({ type: 'int' })
  units: number;

  @Column({ nullable: true })
  contact: string;

  @Column({ name: 'donation_date', type: 'date' })
  donationDate: Date;
}
