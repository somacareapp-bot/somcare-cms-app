import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RadiologyOrder } from './entities/radiology-order.entity';
import { RadiologyOrderItem } from './entities/radiology-order-item.entity';
import { RadiologyTestCatalog } from '../settings/radiology/entities/radiology-test-catalog.entity';
import { RadiologyService } from './radiology.service';
import { RadiologyController } from './radiology.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RadiologyOrder, RadiologyOrderItem, RadiologyTestCatalog])],
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
