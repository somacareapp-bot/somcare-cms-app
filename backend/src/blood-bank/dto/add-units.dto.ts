import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { BloodGroup } from '../../patients/entities/patient.entity';

export class AddUnitsDto {
  @IsEnum(BloodGroup)
  bloodType: BloodGroup;

  @IsInt()
  @Min(1)
  units: number;

  @IsOptional()
  @IsString()
  note?: string;
}
