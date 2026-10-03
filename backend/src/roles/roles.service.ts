import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../users/entities/role.entity';
import { Permission } from '../users/entities/permission.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private readonly rolesRepo: Repository<Role>,
    @InjectRepository(Permission) private readonly permissionsRepo: Repository<Permission>,
  ) {}

  async findAllRoles() {
    return this.rolesRepo.find({ order: { name: 'ASC' } }); // permissions are eager-loaded on Role
  }

  async findAllPermissions() {
    return this.permissionsRepo.find({ order: { module: 'ASC', action: 'ASC' } });
  }

  async createRole(data: { name: string; displayName?: string; description?: string }) {
    const existing = await this.rolesRepo.findOne({ where: { name: data.name } });
    if (existing) throw new ConflictException('A role with this name already exists');
    const role = this.rolesRepo.create({
      name: data.name,
      displayName: data.displayName,
      description: data.description,
      permissions: [],
    } as any) as unknown as Role;
    return this.rolesRepo.save(role);
  }

  async updateRole(
    id: string,
    data: { displayName?: string; description?: string; isActive?: boolean; permissionIds?: string[] },
  ) {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');

    const { permissionIds, ...columns } = data;
    if (Object.keys(columns).length) {
      await this.rolesRepo.update(id, columns);
    }
    if (permissionIds !== undefined) {
      role.permissions = permissionIds.length
        ? await this.permissionsRepo.findBy({ id: In(permissionIds) })
        : [];
      await this.rolesRepo.save(role);
    }
    return this.rolesRepo.findOne({ where: { id } });
  }

  async removeRole(id: string) {
    const role = await this.rolesRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    await this.rolesRepo.delete(id);
    return { deleted: true };
  }
}
