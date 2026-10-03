import { IsString, IsOptional, IsEnum, IsDateString, IsArray, ValidateNested, IsNumber, Min, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/invoice.entity';
import { RevenueCategory } from '../entities/invoice-item.entity';

class InvoiceItemInput {
  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  qty: number;

  @IsNumber()
  @Min(0)
  unitPrice: number;

  @IsOptional()
  @IsEnum(RevenueCategory)
  revenueCategory?: RevenueCategory;

  // Set only for items pulled in via "Load Charges" — identifies the source
  // row (Appointment / LabOrderCharge / RadiologyOrderItem) so BillingService
  // can stamp it invoicedAt in the same transaction as the invoice, and it
  // never gets loaded into a second invoice. Manually-typed line items leave
  // these unset.
  @IsOptional()
  @IsIn(['appointment', 'lab_charge', 'radiology_item'])
  sourceType?: 'appointment' | 'lab_charge' | 'radiology_item';

  @IsOptional()
  @IsString()
  sourceId?: string;
}

export class CreateInvoiceDto {
  @IsString()
  patientId: string;

  @IsString()
  patientName: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemInput)
  items: InvoiceItemInput[];

  @IsOptional()
  @IsNumber()
  @Min(0)
  tax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;
}
