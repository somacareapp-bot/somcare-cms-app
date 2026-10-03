import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgChartNode } from '../org-chart/entities/org-chart-node.entity';
import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { ApprovalRoutingService } from './approval-routing.service';

@Module({
  imports: [TypeOrmModule.forFeature([OrgChartNode, User, Department])],
  providers: [ApprovalRoutingService],
  exports: [ApprovalRoutingService],
})
export class ApprovalRoutingModule {}
