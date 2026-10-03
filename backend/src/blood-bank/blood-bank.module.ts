import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BloodInventoryMovement } from './entities/blood-movement.entity';
import { BloodDonor } from './entities/blood-donor.entity';
import { BloodBankService } from './blood-bank.service';
import { BloodBankController } from './blood-bank.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BloodInventoryMovement, BloodDonor])],
  controllers: [BloodBankController],
  providers: [BloodBankService],
  exports: [BloodBankService],
})
export class BloodBankModule {}
