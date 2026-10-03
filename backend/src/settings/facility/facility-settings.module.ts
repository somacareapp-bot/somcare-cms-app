import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacilitySettings } from './entities/facility-settings.entity';
import { FacilitySettingsService } from './facility-settings.service';
import { FacilitySettingsController } from './facility-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FacilitySettings])],
  controllers: [FacilitySettingsController],
  providers: [FacilitySettingsService],
  exports: [FacilitySettingsService],
})
export class FacilitySettingsModule {}
