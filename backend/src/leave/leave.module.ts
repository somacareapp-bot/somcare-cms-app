import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest } from './entities/leave-request.entity';
import { LeaveAdjustment } from './entities/leave-adjustment.entity';
import { LeaveService } from './leave.service';
import { LeaveController } from './leave.controller';
import { User } from '../users/entities/user.entity';
import { OrgChartNode } from '../org-chart/entities/org-chart-node.entity';
import { ExpensesModule } from '../expenses/expenses.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeaveType, LeaveRequest, LeaveAdjustment, User, OrgChartNode]),
    // Reuses ExpensesService.resolveApproverId so leave follows the same org-chart routing.
    ExpensesModule,
    NotificationsModule,
  ],
  controllers: [LeaveController],
  providers: [LeaveService],
  exports: [LeaveService],
})
export class LeaveModule {}
