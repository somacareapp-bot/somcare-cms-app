import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bed, BedStatus } from './entities/bed.entity';
import { CreateBedDto } from './dto/create-bed.dto';
import { UpdateBedDto } from './dto/update-bed.dto';
import { AssignBedDto } from './dto/assign-bed.dto';

@Injectable()
export class BedsService {
  constructor(
    @InjectRepository(Bed) private bedsRepo: Repository<Bed>,
  ) {}

  async findAll(wardId?: string) {
    return this.bedsRepo.find({
      where: wardId ? { wardId } : {},
      relations: ['ward', 'patient'],
      order: { bedNumber: 'ASC' },
    });
  }

  async findOne(id: string) {
    const bed = await this.bedsRepo.findOne({ where: { id }, relations: ['ward', 'patient'] });
    if (!bed) throw new NotFoundException('Bed not found');
    return bed;
  }

  async create(dto: CreateBedDto) {
    const bed = this.bedsRepo.create(dto);
    return this.bedsRepo.save(bed);
  }

  async update(id: string, dto: UpdateBedDto) {
    const bed = await this.bedsRepo.findOne({ where: { id } });
    if (!bed) throw new NotFoundException('Bed not found');
    Object.assign(bed, dto);
    return this.bedsRepo.save(bed);
  }

  async remove(id: string) {
    const bed = await this.bedsRepo.findOne({ where: { id } });
    if (!bed) throw new NotFoundException('Bed not found');
    await this.bedsRepo.remove(bed);
    return { success: true };
  }

  async assign(id: string, dto: AssignBedDto) {
    const bed = await this.bedsRepo.findOne({ where: { id } });
    if (!bed) throw new NotFoundException('Bed not found');
    if (bed.status === BedStatus.OCCUPIED) {
      throw new BadRequestException('Bed is already occupied');
    }
    bed.patientId = dto.patientId;
    bed.status = BedStatus.OCCUPIED;
    return this.bedsRepo.save(bed);
  }

  async discharge(id: string) {
    const bed = await this.bedsRepo.findOne({ where: { id } });
    if (!bed) throw new NotFoundException('Bed not found');
    bed.patientId = null;
    bed.status = BedStatus.AVAILABLE;
    return this.bedsRepo.save(bed);
  }
}
