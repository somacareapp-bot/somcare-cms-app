import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabSupply } from './entities/lab-supply.entity';
import { LabSupplyPurchase } from './entities/lab-supply-purchase.entity';
import { LabSupplyPurchaseItem } from './entities/lab-supply-purchase-item.entity';
import { LabSupplyStockLog } from './entities/lab-supply-stock-log.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';
import { ApprovalRoutingModule } from '../approvals/approval-routing.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LabSupply, LabSupplyPurchase, LabSupplyPurchaseItem, LabSupplyStockLog, User]), NotificationsModule, UsersModule, ApprovalRoutingModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
