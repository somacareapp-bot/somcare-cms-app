import { IsNumber, Min } from 'class-validator';

export class RecordLabSupplyPurchasePaymentDto {
  @IsNumber() @Min(0.01)
  amount: number;
}
