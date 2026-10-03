import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FacilitySettings } from './entities/facility-settings.entity';
import { UpdateFacilitySettingsDto } from './dto/update-facility-settings.dto';

@Injectable()
export class FacilitySettingsService {
  constructor(
    @InjectRepository(FacilitySettings)
    private readonly repo: Repository<FacilitySettings>,
  ) {}

  async getOrCreate(): Promise<FacilitySettings> {
    const existing = await this.repo.find({ take: 1 });
    if (existing[0]) return existing[0];
    return this.repo.save(this.repo.create({}));
  }

  async update(dto: UpdateFacilitySettingsDto): Promise<FacilitySettings> {
    const settings = await this.getOrCreate();
    Object.assign(settings, dto);
    return this.repo.save(settings);
  }

  async setLogoUrl(logoUrl: string): Promise<FacilitySettings> {
    const settings = await this.getOrCreate();
    settings.logoUrl = logoUrl;
    return this.repo.save(settings);
  }
}
