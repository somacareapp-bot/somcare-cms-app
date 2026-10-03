import { IsUUID, IsNumber, Min } from 'class-validator';

export class DispensePrescriptionDto {
  @IsUUID()
  medicineId: string;

  @IsNumber() @Min(1)
  quantity: number;
}
