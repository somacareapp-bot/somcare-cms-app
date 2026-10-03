import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('vital_ranges')
export class VitalRange {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vital: string;

  @Column()
  min: string;

  @Column()
  max: string;

  @Column()
  unit: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
