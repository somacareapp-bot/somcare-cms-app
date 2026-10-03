import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreatePrescriptionDto {
  @IsString() @MaxLength(200)
  drugName: string;

  @IsOptional() @IsString()
  dose?: string;

  @IsOptional() @IsString()
  frequency?: string;

  @IsOptional() @IsString()
  duration?: string;
}
