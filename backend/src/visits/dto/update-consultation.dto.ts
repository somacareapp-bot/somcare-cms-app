import { IsArray, IsOptional, IsString } from 'class-validator';

export class UpdateConsultationDto {
  @IsOptional() @IsString()
  chiefComplaint?: string;

  @IsOptional() @IsString()
  historyOfPresentIllness?: string;

  @IsOptional() @IsString()
  examinationFindings?: string;

  @IsOptional() @IsString()
  diagnosis?: string;

  @IsOptional() @IsArray()
  diagnosisCodes?: Record<string, any>[];
}
