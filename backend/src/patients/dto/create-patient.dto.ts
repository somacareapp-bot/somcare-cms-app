import { IsString, IsEmail, IsOptional, IsEnum, IsDateString, MaxLength } from 'class-validator';
import { Gender, BloodGroup, PatientType } from '../entities/patient.entity';

export class CreatePatientDto {
  @IsString() @MaxLength(100)
  firstName: string;

  @IsOptional() @IsString() @MaxLength(100)
  middleName?: string;

  @IsString() @MaxLength(100)
  lastName: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @IsOptional() @IsString()
  phone?: string;

  @IsOptional() @IsString()
  alternativePhone?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsString()
  address?: string;

  @IsOptional() @IsString()
  district?: string;

  @IsOptional() @IsString()
  city?: string;

  @IsOptional() @IsString()
  country?: string;

  @IsOptional() @IsString()
  nationality?: string;

  @IsOptional() @IsString()
  emergencyContactName?: string;

  @IsOptional() @IsString()
  emergencyContactPhone?: string;

  @IsOptional() @IsEnum(BloodGroup)
  bloodGroup?: BloodGroup;

  @IsOptional() @IsString()
  allergies?: string;

  @IsOptional() @IsString()
  insuranceCompany?: string;

  @IsOptional() @IsString()
  insuranceNumber?: string;

  @IsOptional() @IsEnum(PatientType)
  patientType?: PatientType;

  @IsOptional() @IsString()
  notes?: string;
}
