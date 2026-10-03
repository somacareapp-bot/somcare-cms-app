import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ActivityLog } from '../../activity-log/activity-log.entity';
import { ActivityLoggingInterceptor } from './activity-logging.interceptor';

// Import this module once in AppModule. It registers ActivityLoggingInterceptor
// as a global interceptor, so every controller is covered automatically.
@Module({
  imports: [TypeOrmModule.forFeature([ActivityLog])],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: ActivityLoggingInterceptor,
    },
  ],
})
export class ActivityLoggingModule {}
