import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { RevenueCategory } from './entities/invoice-item.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const STARTER_SERVICES: { name: string; price: number; revenueCategory: RevenueCategory }[] = [
  { name: 'General Consultation', price: 10, revenueCategory: RevenueCategory.CONSULTATION },
  { name: 'Specialist Consultation', price: 20, revenueCategory: RevenueCategory.CONSULTATION },
  { name: 'Follow-up Consultation', price: 5, revenueCategory: RevenueCategory.CONSULTATION },
  { name: 'Emergency Consultation', price: 25, revenueCategory: RevenueCategory.CONSULTATION },
  { name: 'Wound Dressing', price: 8, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'Suturing', price: 15, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'IV Fluid Administration', price: 12, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'Injection Administration', price: 5, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'Nebulization', price: 10, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'Minor Surgery', price: 40, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'Physiotherapy Session', price: 15, revenueCategory: RevenueCategory.PROCEDURE },
  { name: 'Patient Registration', price: 2, revenueCategory: RevenueCategory.REGISTRATION },
  { name: 'Card Renewal', price: 1, revenueCategory: RevenueCategory.REGISTRATION },
  { name: 'Medical Report / Certificate', price: 5, revenueCategory: RevenueCategory.OTHER },
  { name: 'Ambulance Service', price: 20, revenueCategory: RevenueCategory.OTHER },
];

@Injectable()
export class ServicesCatalogService {
  constructor(
    @InjectRepository(Service)
    private readonly repo: Repository<Service>,
  ) {}

  findAll(search?: string) {
    if (search?.trim()) {
      return this.repo.find({
        where: { name: ILike(`%${search.trim()}%`), isActive: true },
        order: { name: 'ASC' },
      });
    }
    return this.repo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  create(dto: CreateServiceDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  remove(id: string) {
    return this.repo.delete(id);
  }

  async seedIfEmpty() {
    const count = await this.repo.count();
    if (count > 0) {
      return { seeded: false, count };
    }
    const rows = STARTER_SERVICES.map((s) => this.repo.create(s));
    await this.repo.save(rows);
    return { seeded: true, count: rows.length };
  }
}
