import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class RestockLabSupplyDto {
  @IsNumber() @Min(1)
  quantity: number;

  @IsOptional() @IsString()
  reason?: string;

  @IsOptional() @IsNumber() @Min(0)
  unitCost?: number;
}
