import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from './entities/visit.entity';
import { Prescription } from './entities/prescription.entity';
import { VisitsService } from './visits.service';
import { VisitsController } from './visits.controller';
import { PublicTrackingController } from './public-tracking.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { UsersModule } from '../users/users.module';

import { LabOrder } from '../laboratory/entities/lab-order.entity';
import { RadiologyOrder } from '../radiology/entities/radiology-order.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Visit, Prescription, LabOrder, RadiologyOrder]), NotificationsModule, UsersModule],
  controllers: [VisitsController, PublicTrackingController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
