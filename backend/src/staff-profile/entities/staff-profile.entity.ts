// backend/src/staff-profile/entities/staff-profile.entity.ts
//
// One-to-one extension of User with HR-style profile data.
// Kept as a separate table (not columns on User) so the core auth/User
// entity stays lean and this can be optional per staff member.

import {
  Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn,
  CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

@Entity('staff_profiles')
export class StaffProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  // ----- Personal -----
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  // ----- Professional -----
  @Column({ nullable: true })
  specialization: string;

  @Column({ name: 'years_of_experience', type: 'int', nullable: true })
  yearsOfExperience: number;

  // Structured JSON, e.g. [{ employer, title, startDate, endDate, description }]
  @Column({ name: 'past_experience', type: 'jsonb', nullable: true })
  pastExperience: Array<{
    employer?: string;
    title?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;

  // Structured JSON, e.g. [{ institution, qualification, year }]
  @Column({ type: 'jsonb', nullable: true })
  education: Array<{
    institution?: string;
    qualification?: string;
    year?: string;
  }>;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[];

  // ----- CV -----
  @Column({ name: 'cv_file_url', nullable: true })
  cvFileUrl: string;

  @Column({ name: 'cv_original_filename', nullable: true })
  cvOriginalFilename: string;

  @Column({ name: 'cv_uploaded_at', type: 'timestamptz', nullable: true })
  cvUploadedAt: Date;

  // true once auto-fill has run on the current CV; staff/admin can still edit fields after
  @Column({ name: 'cv_parsed', type: 'boolean', default: false })
  cvParsed: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
