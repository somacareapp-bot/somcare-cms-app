import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginSessionSettings } from './entities/login-session-settings.entity';
import { UpdateLoginSessionSettingsDto } from './dto/update-login-session-settings.dto';

@Injectable()
export class LoginSessionService {
  constructor(
    @InjectRepository(LoginSessionSettings)
    private readonly repo: Repository<LoginSessionSettings>,
  ) {}

  async getOrCreate(): Promise<LoginSessionSettings> {
    const existing = await this.repo.find({ take: 1 });
    if (existing[0]) return existing[0];
    return this.repo.save(this.repo.create({}));
  }

  async update(dto: UpdateLoginSessionSettingsDto): Promise<LoginSessionSettings> {
    const settings = await this.getOrCreate();
    Object.assign(settings, dto);
    return this.repo.save(settings);
  }
}
