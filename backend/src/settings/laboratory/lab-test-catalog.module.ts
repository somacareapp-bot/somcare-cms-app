import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabTestCatalog } from './entities/lab-test-catalog.entity';
import { LabTestSupplyItem } from './entities/lab-test-supply-item.entity';
import { LabSupply } from '../../inventory/entities/lab-supply.entity';
import { LabTestCatalogService } from './lab-test-catalog.service';
import { LabTestCatalogController } from './lab-test-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LabTestCatalog, LabTestSupplyItem, LabSupply])],
  controllers: [LabTestCatalogController],
  providers: [LabTestCatalogService],
  exports: [LabTestCatalogService],
})
export class LabTestCatalogModule {}
