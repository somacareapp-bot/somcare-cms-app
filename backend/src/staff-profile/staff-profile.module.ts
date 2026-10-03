// backend/src/staff-profile/staff-profile.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffProfile } from './entities/staff-profile.entity';
import { StaffProfileService } from './staff-profile.service';
import { StaffProfileController } from './staff-profile.controller';
import { CvParserService } from './cv-parser.service';

@Module({
  imports: [TypeOrmModule.forFeature([StaffProfile])],
  controllers: [StaffProfileController],
  providers: [StaffProfileService, CvParserService],
  exports: [StaffProfileService],
})
export class StaffProfileModule {}
