import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ward } from './entities/ward.entity';
import { BedStatus } from './entities/bed.entity';
import { CreateWardDto } from './dto/create-ward.dto';
import { UpdateWardDto } from './dto/update-ward.dto';

@Injectable()
export class WardsService {
  constructor(
    @InjectRepository(Ward) private wardsRepo: Repository<Ward>,
  ) {}

  async findAll() {
    const wards = await this.wardsRepo.find({
      relations: ['beds', 'department'],
      order: { name: 'ASC' },
    });
    // occupied is derived live from bed statuses, never stored,
    // so it can't drift from what's actually in the beds table.
    return wards.map((ward) => ({
      ...ward,
      occupied: ward.beds.filter((b) => b.status === BedStatus.OCCUPIED).length,
    }));
  }

  async findOne(id: string) {
    const ward = await this.wardsRepo.findOne({
      where: { id },
      relations: ['beds', 'department'],
    });
    if (!ward) throw new NotFoundException('Ward not found');
    return {
      ...ward,
      occupied: ward.beds.filter((b) => b.status === BedStatus.OCCUPIED).length,
    };
  }

  async create(dto: CreateWardDto) {
    const ward = this.wardsRepo.create(dto);
    return this.wardsRepo.save(ward);
  }

  async update(id: string, dto: UpdateWardDto) {
    const ward = await this.wardsRepo.findOne({ where: { id } });
    if (!ward) throw new NotFoundException('Ward not found');
    Object.assign(ward, dto);
    return this.wardsRepo.save(ward);
  }

  async remove(id: string) {
    const ward = await this.wardsRepo.findOne({ where: { id } });
    if (!ward) throw new NotFoundException('Ward not found');
    await this.wardsRepo.remove(ward);
    return { success: true };
  }
}
