import { IsOptional, IsString } from 'class-validator';

export class MarkPaidExpenseDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
