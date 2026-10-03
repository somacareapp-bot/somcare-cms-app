import { IsOptional, IsString, IsInt, Min, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { PatientType, PatientStatus } from '../entities/patient.entity';

export class QueryPatientDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;

  @IsOptional() @IsEnum(PatientType)
  patientType?: PatientType;

  @IsOptional() @IsEnum(PatientStatus)
  patientStatus?: PatientStatus;
}
