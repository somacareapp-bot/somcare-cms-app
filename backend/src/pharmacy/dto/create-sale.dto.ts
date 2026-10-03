import { IsString, IsOptional, IsArray, ValidateNested, IsUUID, IsNumber, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '../entities/sale.entity';

class SaleItemDto {
  @IsUUID()
  medicineId: string;

  @IsNumber() @Min(1)
  quantity: number;
}

export class CreateSaleDto {
  // NEW: set when the sale is tied to a registered patient (from the
  // Patient Information search box). Leave undefined for a walk-in sale.
  @IsOptional() @IsUUID()
  patientId?: string;

  @IsOptional() @IsString()
  customerName?: string;

  @IsOptional() @IsString()
  customerPhone?: string;

  @IsOptional() @IsString()
  customerAddress?: string;

  @IsOptional() @IsNumber() @Min(0)
  discountAmount?: number;

  @IsOptional() @IsNumber() @Min(0)
  paidAmount?: number;

  @IsOptional() @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional() @IsString()
  cashierName?: string;

  // NEW: free-text note, shown on the receipt.
  @IsOptional() @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleItemDto)
  items: SaleItemDto[];
}
