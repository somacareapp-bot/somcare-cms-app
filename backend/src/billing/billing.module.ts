import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from './entities/invoice.entity';
import { InvoiceItem } from './entities/invoice-item.entity';
import { Payment } from './entities/payment.entity';
import { LabOrder } from '../laboratory/entities/lab-order.entity';
import { LabOrderCharge } from '../laboratory/entities/lab-order-charge.entity';
import { Prescription } from '../visits/entities/prescription.entity';
import { Visit } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { LabTestCatalog } from '../settings/laboratory/entities/lab-test-catalog.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Service } from './entities/service.entity';
import { RadiologyOrder } from '../radiology/entities/radiology-order.entity';
import { RadiologyOrderItem } from '../radiology/entities/radiology-order-item.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Invoice,
      InvoiceItem,
      Payment,
      LabOrder,
      LabOrderCharge,
      Prescription,
      Visit,
      Appointment,
      LabTestCatalog,
      Patient,
      Medicine,
      Service,
      RadiologyOrder,
      RadiologyOrderItem,
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
