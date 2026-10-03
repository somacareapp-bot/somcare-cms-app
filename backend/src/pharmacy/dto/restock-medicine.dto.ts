import { IsNumber, Min } from 'class-validator';

export class RestockMedicineDto {
  @IsNumber() @Min(1)
  quantity: number;
}
