import { IsString, IsNumber, Min, IsDateString, IsOptional } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  // Validated against the live expense_categories table in
  // ExpensesService.create(), not a fixed enum — see expense-categories.service.ts.
  @IsString()
  category: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
