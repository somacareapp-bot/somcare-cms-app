import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ward } from './entities/ward.entity';
import { Bed } from './entities/bed.entity';
import { WardsService } from './wards.service';
import { BedsService } from './beds.service';
import { WardsController } from './wards.controller';
import { BedsController } from './beds.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Ward, Bed])],
  controllers: [WardsController, BedsController],
  providers: [WardsService, BedsService],
  exports: [WardsService, BedsService],
})
export class BedsModule {}
