import { IsOptional, IsString } from 'class-validator';

export class UpdateVitalsDto {
  @IsOptional() @IsString()
  bloodPressure?: string;

  @IsOptional() @IsString()
  heartRate?: string;

  @IsOptional() @IsString()
  temperature?: string;

  @IsOptional() @IsString()
  spo2?: string;
}
