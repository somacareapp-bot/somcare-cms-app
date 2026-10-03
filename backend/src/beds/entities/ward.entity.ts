import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Bed } from './bed.entity';

@Entity('wards')
export class Ward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'department_id' })
  departmentId: string;

  @ManyToOne(() => Department, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  // Configured bed capacity for the ward. Actual live occupancy is derived
  // from counting related Bed rows (see WardsService.findAll), not stored
  // here, so it can never drift out of sync with real bed data.
  @Column({ name: 'total_beds', default: 0 })
  totalBeds: number;

  @OneToMany(() => Bed, (bed) => bed.ward)
  beds: Bed[];
}
