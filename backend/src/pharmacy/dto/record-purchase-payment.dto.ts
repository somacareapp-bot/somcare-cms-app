import { IsNumber, Min } from 'class-validator';

export class RecordPurchasePaymentDto {
  @IsNumber() @Min(0.01)
  amount: number;
}
