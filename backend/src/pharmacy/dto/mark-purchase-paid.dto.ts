import { IsOptional, IsString } from 'class-validator';

// Accountant closes out an admin-approved purchase once the balance is $0
export class MarkPurchasePaidDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
