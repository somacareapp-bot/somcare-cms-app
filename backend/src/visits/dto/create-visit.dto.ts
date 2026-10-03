import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { VisitUrgency } from '../entities/visit.entity';

export class CreateVisitDto {
  @IsUUID()
  patientId: string;

  @IsOptional() @IsUUID()
  appointmentId?: string;

  @IsOptional() @IsUUID()
  doctorId?: string;

  @IsOptional() @IsString()
  department?: string;

  @IsOptional() @IsEnum(VisitUrgency)
  urgency?: VisitUrgency;
}
