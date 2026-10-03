import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, Min } from 'class-validator';
import { MedicineCategory } from '../entities/medicine.entity';

export class CreateMedicineDto {
  @IsString()
  name: string;

  @IsOptional() @IsString()
  genericName?: string;

  @IsOptional() @IsEnum(MedicineCategory)
  category?: MedicineCategory;

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
