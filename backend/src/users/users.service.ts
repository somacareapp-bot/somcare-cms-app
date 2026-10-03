import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserStatus } from './entities/user.entity';
import { Role } from './entities/role.entity';

function toSafe(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly rolesRepo: Repository<Role>,
  ) {}

  // Active users whose roles include 'doctor' — used for the check-in doctor dropdown.
  // Pass departmentId to narrow the list to doctors assigned to that department.
  async findDoctors(departmentId?: string): Promise<Partial<User>[]> {
    const users = await this.usersRepo.find({
      where: { status: UserStatus.ACTIVE },
      relations: ['department'],
      order: { firstName: 'ASC' },
    });
    return users
      .filter((u) => u.roles?.some((r) => r.name === 'doctor'))
      .filter((u) => !departmentId || u.departmentId === departmentId)
      .map(({ passwordHash, ...safe }) => safe);
  }

  async findAllRoles() {
    return this.rolesRepo.find({ order: { name: 'ASC' } });
  }

  async findAll() {
    const users = await this.usersRepo.find({
      relations: ['department'],
      order: { firstName: 'ASC' },
    });
    return users.map(toSafe);
  }

  async findOne(id: string) {
    const user = await this.usersRepo.findOne({
      where: { id },
      relations: ['roles', 'department'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  // Look up all active users holding any of the given role names, e.g.
  // ['administrator'] or ['accountant', 'administrator']. Used for
  // role-based notification fan-out (e.g. "notify all accountants").
  async findByRoleNames(roleNames: string[]) {
    return this.usersRepo
      .createQueryBuilder('user')
      .innerJoin('user.roles', 'role')
      .where('role.name IN (:...roleNames)', { roleNames })
      .andWhere('user.status = :status', { status: 'active' })
      .getMany();
  }

  async create(data: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    departmentId?: string | null;
    position?: string;
    shift?: string;
    salary?: number;
    roleIds?: string[];
  }) {
    const existing = await this.usersRepo.findOne({ where: { username: data.username } });
    if (existing) {
      throw new ConflictException('A user with this username already exists');
    }
    const passwordHash = await bcrypt.hash(data.password, 10);
    const roles = data.roleIds?.length
      ? await this.rolesRepo.findBy({ id: In(data.roleIds) })
      : [];
    const user = this.usersRepo.create({
      username: data.username,
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: data.phone,
      departmentId: data.departmentId ?? null,
      position: data.position,
      shift: data.shift,
      salary: data.salary,
      roles,
    } as any) as unknown as User;
    const saved = await this.usersRepo.save(user);
    return toSafe(saved);
  }

  async update(id: string, data: Partial<User> & { roleIds?: string[] }) {
    const user = await this.usersRepo.findOne({ where: { id }, relations: ['roles'] });
    if (!user) throw new NotFoundException('Staff member not found');

    const { roleIds, ...incoming } = data as any;

    // Only these columns can be changed through this endpoint
    // (never passwordHash, id, roles, department objects, etc.).
    const EDITABLE = [
      'firstName', 'lastName', 'email', 'phone', 'departmentId',
      'position', 'shift', 'salary', 'status', 'language', 'theme', 'profilePhoto',
    ];
    const columns: Record<string, any> = {};
    for (const k of EDITABLE) {
      if (k in incoming && incoming[k] !== undefined) columns[k] = incoming[k];
    }
    if ('departmentId' in columns && !columns.departmentId) columns.departmentId = null;

    // Apply everything onto the loaded user and save ONCE, so a stale copy
    // of the old values is never written back over the new ones.
    Object.assign(user, columns);
    if (roleIds !== undefined) {
      user.roles = roleIds.length ? await this.rolesRepo.findBy({ id: In(roleIds) }) : [];
    }
    await this.usersRepo.save(user);

    const updated = await this.usersRepo.findOne({ where: { id }, relations: ['department'] });
    return toSafe(updated as User);
  }

  async remove(id: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Staff member not found');
    await this.usersRepo.delete(id);
    return { deleted: true };
  }

  // Admin-triggered reset: generates (or accepts) a new password, hashes it,
  // and forces the user to change it on next login. Returns the plaintext
  // temp password ONCE so the admin can hand it to the user out of band —
  // it is never stored or returned again after this call.
  async resetPassword(id: string, newPassword?: string) {
    const user = await this.usersRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Staff member not found');

    const tempPassword = newPassword ?? this.generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await this.usersRepo.update(id, {
      passwordHash,
      mustChangePassword: true,
    } as any);

    return { tempPassword, username: user.username };
  }

  private generateTempPassword(): string {
    // Avoids visually-ambiguous characters (0/O, 1/l/I).
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    let pwd = '';
    for (let i = 0; i < 12; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    return pwd;
  }
}
