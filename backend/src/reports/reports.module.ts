import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Visit } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Prescription } from '../visits/entities/prescription.entity';
import { LabOrder } from '../laboratory/entities/lab-order.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Purchase } from '../pharmacy/entities/purchase.entity';
import { LabSupplyPurchase } from '../inventory/entities/lab-supply-purchase.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { Payment } from '../billing/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
import { Sale } from '../pharmacy/entities/sale.entity';
import { SaleReturn } from '../pharmacy/entities/sale-return.entity';
import { SaleItem } from '../pharmacy/entities/sale-item.entity';
import { RadiologyOrder } from '../radiology/entities/radiology-order.entity';
import { LabSupplyStockLog } from '../inventory/entities/lab-supply-stock-log.entity';
import { ActivityLog } from '../activity-log/activity-log.entity';
import { LabOrderCharge } from '../laboratory/entities/lab-order-charge.entity';
import { LabSupply } from '../inventory/entities/lab-supply.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Visit, Appointment, Prescription, LabOrder, User, Patient, Medicine, Invoice, Payment, Expense, Purchase, LabSupplyPurchase, Sale, SaleReturn, SaleItem, RadiologyOrder, LabSupplyStockLog, ActivityLog, LabOrderCharge, LabSupply ])],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
