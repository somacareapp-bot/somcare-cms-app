import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Flat catalog — unlike lab tests, imaging studies don't expand into panels/
// components, so this is deliberately simpler than LabTestCatalog.
@Entity('radiology_test_catalog')
export class RadiologyTestCatalog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  // Group heading in the ordering UI: 'X-Ray', 'Ultrasound', 'CT Scan', 'MRI'.
  @Column({ nullable: true })
  category: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
