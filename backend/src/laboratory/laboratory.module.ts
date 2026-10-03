import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabOrder } from './entities/lab-order.entity';
import { LabOrderItem } from './entities/lab-order-item.entity';
import { LabOrderCharge } from './entities/lab-order-charge.entity';
import { LabTestCatalog } from '../settings/laboratory/entities/lab-test-catalog.entity';
import { LabTestSupplyItem } from '../settings/laboratory/entities/lab-test-supply-item.entity';
import { LabSupply } from '../inventory/entities/lab-supply.entity';
import { LabSupplyStockLog } from '../inventory/entities/lab-supply-stock-log.entity';
import { LaboratoryService } from './laboratory.service';
import { LaboratoryController } from './laboratory.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabOrder,
      LabOrderItem,
      LabOrderCharge,
      LabTestCatalog,
      LabTestSupplyItem,
      LabSupply,
      LabSupplyStockLog,
    ]),
  ],
  controllers: [LaboratoryController],
  providers: [LaboratoryService],
  exports: [LaboratoryService],
})
export class LaboratoryModule {}
