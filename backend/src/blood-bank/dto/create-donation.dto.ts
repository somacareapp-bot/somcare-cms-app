import { IsEnum, IsInt, IsOptional, IsString, IsDateString, Min } from 'class-validator';
import { BloodGroup } from '../../patients/entities/patient.entity';

export class CreateDonationDto {
  @IsString()
  name: string;

  @IsEnum(BloodGroup)
  bloodType: BloodGroup;

  @IsInt()
  @Min(1)
  units: number;

  @IsOptional()
  @IsString()
  contact?: string;

  @IsOptional()
  @IsDateString()
  donationDate?: string;
}
