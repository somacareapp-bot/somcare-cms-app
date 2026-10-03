import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

// Single-row table — one facility per install. getOrCreate() in the service
// guarantees a row exists so the frontend never has to handle a 404.
@Entity('facility_settings')
export class FacilitySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'SOMCARE Medical Center' })
  name: string;

  @Column({ nullable: true, default: 'Better Care \u2022 Healthier Tomorrow' })
  tagline: string;

  // relative path under /uploads, e.g. "/uploads/facility/logo-169999.png"
  @Column({ nullable: true })
  logoUrl: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  // Mobile-money / bank details shown on reports & invoices so patients know where to pay
  @Column({ nullable: true })
  eDahabNumber: string;

  @Column({ nullable: true })
  zaadNumber: string;

  @Column({ nullable: true })
  accountNumber: string;

  @UpdateDateColumn()
  updatedAt: Date;
}
