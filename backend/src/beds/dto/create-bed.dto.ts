import { IsString, IsUUID, IsInt, IsNumber, IsOptional, IsEnum, Min } from 'class-validator';
import { BedStatus } from '../entities/bed.entity';

export class CreateBedDto {
  @IsString()
  bedNumber: string;

  @IsUUID()
  wardId: string;

  @IsInt()
  @Min(0)
  floor: number;

  @IsNumber()
  @Min(0)
  dailyRate: number;

  @IsOptional()
  @IsEnum(BedStatus)
  status?: BedStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
