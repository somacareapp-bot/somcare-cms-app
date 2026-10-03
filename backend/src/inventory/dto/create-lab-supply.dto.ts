import { IsString, IsOptional, IsEnum, IsNumber, Min, IsDateString } from 'class-validator';
import { LabSupplyCategory } from '../entities/lab-supply.entity';

export class CreateLabSupplyDto {
  @IsString()
  name: string;

  @IsOptional() @IsEnum(LabSupplyCategory)
  category?: LabSupplyCategory;

  @IsOptional() @IsString()
  unit?: string;

  @IsOptional() @IsNumber() @Min(0)
  stockQuantity?: number;

  @IsOptional() @IsNumber() @Min(0)
  reorderLevel?: number;

  @IsOptional() @IsNumber() @Min(0)
  costPrice?: number;

  @IsOptional() @IsNumber() @Min(0)
  sellPrice?: number;

  @IsOptional() @IsString()
  batchNumber?: string;

  @IsOptional() @IsDateString()
  expiryDate?: string;
}
