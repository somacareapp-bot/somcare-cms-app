import { IsString, IsUUID, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateRadiologyOrderDto {
  @IsUUID()
  visitId: string;

  @IsUUID()
  patientId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  testIds: string[];

  @IsOptional() @IsString()
  notes?: string;
}
