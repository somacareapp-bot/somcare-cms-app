import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RadiologyTestCatalog } from './entities/radiology-test-catalog.entity';
import { RadiologyTestCatalogService } from './radiology-test-catalog.service';
import { RadiologyTestCatalogController } from './radiology-test-catalog.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RadiologyTestCatalog])],
  controllers: [RadiologyTestCatalogController],
  providers: [RadiologyTestCatalogService],
  exports: [RadiologyTestCatalogService],
})
export class RadiologyTestCatalogModule {}
