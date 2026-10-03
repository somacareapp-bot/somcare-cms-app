import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';

@Entity('departments')
export class Department extends BaseEntity {
  @Column({ unique: true })
  name: string;

  @Column({ name: 'head_doctor_id', nullable: true })
  headDoctorId: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'head_doctor_id' })
  headDoctor: User | null;

  @Column({ nullable: true })
  rooms: number;
}
