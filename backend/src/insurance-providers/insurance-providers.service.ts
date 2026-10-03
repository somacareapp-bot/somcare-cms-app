import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InsuranceProvider } from './entities/insurance-provider.entity';
import { CreateInsuranceProviderDto } from './dto/create-insurance-provider.dto';
import { UpdateInsuranceProviderDto } from './dto/update-insurance-provider.dto';

@Injectable()
export class InsuranceProvidersService {
  constructor(
    @InjectRepository(InsuranceProvider)
    private readonly repo: Repository<InsuranceProvider>,
  ) {}

  findAll() {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const provider = await this.repo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException('Insurance provider not found');
    return provider;
  }

  async create(dto: CreateInsuranceProviderDto) {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('An insurance provider with this name already exists');
    }
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateInsuranceProviderDto) {
    const provider = await this.findOne(id);
    Object.assign(provider, dto);
    return this.repo.save(provider);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
