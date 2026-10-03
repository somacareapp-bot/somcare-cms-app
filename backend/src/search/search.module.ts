import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patient } from '../patients/entities/patient.entity';
import { Visit } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patient, Visit, Appointment, Invoice])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
