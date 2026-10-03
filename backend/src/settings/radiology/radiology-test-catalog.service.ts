import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { RadiologyTestCatalog } from './entities/radiology-test-catalog.entity';
import { CreateRadiologyTestDto } from './dto/create-radiology-test.dto';
import { UpdateRadiologyTestDto } from './dto/update-radiology-test.dto';

// Seed data for the five categories the facility asked for. Prices are
// starting defaults — editable afterward from this same catalog (no
// dedicated Settings page yet; PATCH /settings/radiology/tests/:id works
// today via API, same as before a UI exists for it).
const SEED_TESTS: { name: string; category: string; price: number }[] = [
  { name: 'Chest X-Ray',      category: 'X-Ray',      price: 15 },
  { name: 'Abdominal X-Ray',  category: 'X-Ray',      price: 15 },
  { name: 'Pelvis X-Ray',     category: 'X-Ray',      price: 15 },
  { name: 'Bone X-Ray',       category: 'X-Ray',      price: 15 },
  { name: 'Abdominal Scan',   category: 'Ultrasound', price: 25 },
  { name: 'Pelvic Scan',      category: 'Ultrasound', price: 25 },
  { name: 'Obstetric Scan',   category: 'Ultrasound', price: 25 },
  { name: 'Renal Scan',       category: 'Ultrasound', price: 25 },
  { name: 'Head CT',          category: 'CT Scan',    price: 60 },
  { name: 'Chest CT',         category: 'CT Scan',    price: 60 },
  { name: 'Abdominal CT',     category: 'CT Scan',    price: 60 },
  { name: 'Pelvic CT',        category: 'CT Scan',    price: 60 },
  { name: 'Brain MRI',        category: 'MRI',        price: 90 },
  { name: 'Spine MRI',        category: 'MRI',        price: 90 },
  { name: 'Knee MRI',         category: 'MRI',        price: 90 },
  { name: 'Abdominal MRI',    category: 'MRI',        price: 90 },
];

@Injectable()
export class RadiologyTestCatalogService {
  constructor(
    @InjectRepository(RadiologyTestCatalog)
    private readonly repo: Repository<RadiologyTestCatalog>,
  ) {}

  async findAll(search?: string) {
    // Self-heals an empty catalog on first load, since /seed itself requires
    // a JWT and the ordering dropdown has none to send before this call.
    await this.seedIfEmpty();
    const where = search ? { name: ILike(`%${search}%`) } : {};
    return this.repo.find({ where, order: { category: 'ASC', name: 'ASC' } });
  }

  async findOne(id: string) {
    const test = await this.repo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Radiology test not found');
    return test;
  }

  async create(dto: CreateRadiologyTestDto) {
    return this.repo.save(this.repo.create(dto));
  }

  async update(id: string, dto: UpdateRadiologyTestDto) {
    const test = await this.findOne(id);
    Object.assign(test, dto);
    return this.repo.save(test);
  }

  async remove(id: string) {
    const test = await this.findOne(id);
    await this.repo.remove(test);
    return { success: true };
  }

  async seedIfEmpty() {
    const count = await this.repo.count();
    if (count > 0) return { seeded: false, count };
    const rows = SEED_TESTS.map((t) => this.repo.create(t));
    await this.repo.save(rows);
    return { seeded: true, count: rows.length };
  }
}
