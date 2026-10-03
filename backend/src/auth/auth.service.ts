import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from '../users/entities/user.entity';
import { AuditLog } from '../audit/entities/audit-log.entity';
import { Department } from '../departments/entities/department.entity';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MINUTES = 30;

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private auditRepository: Repository<AuditLog>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    private jwtService: JwtService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
  ) {}

  // Admin-assisted "forgot password": never reveals whether the username exists.
  // Notifies every active administrator with a deep link into the Staff page,
  // filtered to this person, so they can set a new password from there.
  async forgotPassword(username: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user || user.status !== UserStatus.ACTIVE) return;

    const admins = await this.usersService.findByRoleNames(['administrator']);
    const link = `/staff?q=${encodeURIComponent(user.username)}`;
    await Promise.all(
      admins.map((admin) =>
        this.notificationsService.create({
          recipientId: admin.id,
          type: NotificationType.SYSTEM,
          message: `Password reset requested for ${user.username}`,
          link,
        } as any),
      ),
    );
  }

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepository.findOne({
      where: { username },
      relations: ['roles', 'roles.permissions'],
    });

    if (!user) return null;

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Account locked. Try again after ${user.lockedUntil.toLocaleTimeString()}`,
      );
    }

    // Check if account is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is inactive. Contact administrator.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      // Increment login attempts
      user.loginAttempts += 1;
      if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS) {
        const lockUntil = new Date();
        lockUntil.setMinutes(lockUntil.getMinutes() + this.LOCK_DURATION_MINUTES);
        user.lockedUntil = lockUntil;
        user.status = UserStatus.LOCKED;
      }
      await this.userRepository.save(user);
      return null;
    }

    // Reset login attempts on success
    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    await this.userRepository.save(user);

    return user;
  }

  async login(user: User, ipAddress?: string) {
    const permissions = this.extractPermissions(user);
    // A user is a department head if any department's headDoctorId points at them.
    const isDeptHead = (await this.departmentRepository.count({ where: { headDoctorId: user.id } })) > 0;
    const payload = {
      sub: user.id,
      username: user.username,
      roles: user.roles.map((r) => r.name),
      permissions,
    };

    // Audit log
    await this.auditRepository.save({
      userId: user.id,
      username: user.username,
      action: 'LOGIN',
      module: 'auth',
      ipAddress,
      description: `User ${user.username} logged in`,
    });

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        department: user.department?.name ?? null,
        roles: user.roles.map((r) => r.name),
        permissions,
        language: user.language,
        theme: user.theme,
        profilePhoto: user.profilePhoto,
        mustChangePassword: user.mustChangePassword,
        isDeptHead,
      },
    };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isValid) throw new BadRequestException('Current password is incorrect');
    if (currentPassword === newPassword) {
      throw new BadRequestException('New password must be different from the current password');
    }

    const rounds = parseInt(process.env.BCRYPT_ROUNDS || '12');
    user.passwordHash = await bcrypt.hash(newPassword, rounds);
    user.mustChangePassword = false;
    await this.userRepository.save(user);

    return { message: 'Password changed successfully' };
  }

  private extractPermissions(user: User): string[] {
    const permissions = new Set<string>();
    user.roles.forEach((role) => {
      role.permissions?.forEach((perm) => permissions.add(perm.name));
    });
    return Array.from(permissions);
  }
}
