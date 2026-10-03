import { ResetController } from './reset.controller';
import { ResetService } from './reset.service';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BackupController } from './backup.controller';
import { BackupService } from './backup.service';

@Module({
  imports: [ConfigModule],
  controllers: [BackupController, ResetController],
  providers: [BackupService, ResetService],
})
export class BackupModule {}
