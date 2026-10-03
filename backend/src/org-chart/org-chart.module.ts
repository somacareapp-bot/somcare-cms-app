import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgChartNode } from './entities/org-chart-node.entity';
import { User } from '../users/entities/user.entity';
import { OrgChartService } from './org-chart.service';
import { OrgChartController } from './org-chart.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrgChartNode, User])],
  controllers: [OrgChartController],
  providers: [OrgChartService],
  exports: [OrgChartService],
})
export class OrgChartModule {}
