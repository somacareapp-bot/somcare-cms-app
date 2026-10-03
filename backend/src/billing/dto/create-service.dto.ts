import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RevenueCategory } from '../entities/invoice-item.entity';

export class CreateServiceDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  price: number;

  @IsEnum(RevenueCategory)
  revenueCategory: RevenueCategory;

  @IsOptional()
  isActive?: boolean;
}
