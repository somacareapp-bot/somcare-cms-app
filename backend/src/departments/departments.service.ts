import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { User, UserStatus } from '../users/entities/user.entity';

function normalizeHeadDoctorId(id?: string | null): string | null {
  return id ? id : null;
}

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentsRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async findAll() {
    const departments = await this.departmentsRepo.find({
      relations: ['headDoctor'],
      order: { name: 'ASC' },
    });

    // Staff count is calculated live, never stored, so it can't drift out of sync
    const staffCounts = await this.usersRepo
      .createQueryBuilder('user')
      .select('user.departmentId', 'departmentId')
      .addSelect('COUNT(*)', 'count')
      .where('user.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('user.departmentId IS NOT NULL')
      .groupBy('user.departmentId')
      .getRawMany<{ departmentId: string; count: string }>();


    const countMap = new Map(staffCounts.map((r) => [r.departmentId, Number(r.count)]));

    return departments.map((d) => ({
      id: d.id,
      name: d.name,
      rooms: d.rooms,
      headDoctor: d.headDoctor ? { id: d.headDoctor.id, fullName: d.headDoctor.fullName } : null,
      staffCount: countMap.get(d.id) ?? 0,
    }));
  }

  async create(name: string, rooms?: number, headDoctorId?: string) {
    const existing = await this.departmentsRepo.findOne({ where: { name } });
    if (existing) {
      throw new ConflictException('A department with this name already exists');
    }
    const dept = this.departmentsRepo.create({
      name,
      rooms,
      headDoctorId: normalizeHeadDoctorId(headDoctorId),
    });
    return this.departmentsRepo.save(dept);
  }

  async update(id: string, data: { name?: string; rooms?: number; headDoctorId?: string | null }) {
    const patch = {
      ...data,
      ...(data.headDoctorId !== undefined
        ? { headDoctorId: normalizeHeadDoctorId(data.headDoctorId) }
        : {}),
    };
    await this.departmentsRepo.update(id, patch);
    return this.departmentsRepo.findOne({ where: { id }, relations: ['headDoctor'] });
  }

  async remove(id: string) {
    await this.departmentsRepo.delete(id);
    return { deleted: true };
  }
}
