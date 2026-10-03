import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

// Single-row table — one policy per install. getOrCreate() in the service
// guarantees a row exists so the frontend never has to handle a 404.
@Entity('login_session_settings')
export class LoginSessionSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_timeout', default: 120 })
  sessionTimeout: number;

  @Column({ name: 'max_login_attempts', default: 5 })
  maxLoginAttempts: number;

  @Column({ name: 'password_expiry', default: 90 })
  passwordExpiry: number;

  @Column({ name: 'min_password_length', default: 8 })
  minPasswordLength: number;

  @Column({ name: 'require_2fa', default: false })
  require2fa: boolean;

  @Column({ name: 'force_change', default: true })
  forceChange: boolean;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
