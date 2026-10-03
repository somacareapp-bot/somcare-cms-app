import { IsString, IsUUID, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

export class CreateLabOrderDto {
  @IsUUID()
  visitId: string;

  @IsUUID()
  patientId: string;

  // Catalog IDs the doctor selected. If any is a panel (e.g. CBC), the server
  // expands it into its component tests when building the order.
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  testIds: string[];

  @IsOptional() @IsString()
  notes?: string;
}
