import { IsOptional, IsString } from 'class-validator';

// Accountant closes out an admin-approved lab supply purchase once the balance is $0
export class MarkLabSupplyPurchasePaidDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
