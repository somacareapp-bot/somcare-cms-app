import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Branch } from './entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(Branch)
    private readonly branchesRepo: Repository<Branch>,
  ) {}

  findAll() {
    return this.branchesRepo.find({ order: { name: 'ASC' } });
  }

  async create(data: { name: string; address?: string; phone?: string; manager?: string; status?: string }) {
    const existing = await this.branchesRepo.findOne({ where: { name: data.name } });
    if (existing) throw new ConflictException('A branch with this name already exists');
    return this.branchesRepo.save(this.branchesRepo.create(data));
  }

  async update(
    id: string,
    data: Partial<{ name: string; address: string; phone: string; manager: string; status: string }>,
  ) {
    const branch = await this.branchesRepo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    Object.assign(branch, data);
    return this.branchesRepo.save(branch);
  }

  async remove(id: string) {
    await this.branchesRepo.delete(id);
    return { deleted: true };
  }
}
