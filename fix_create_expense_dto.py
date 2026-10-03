path = "backend/src/expenses/dto/create-expense.dto.ts"
with open(path) as f:
    content = f.read()

old = """import { IsString, IsNumber, Min, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { ExpenseCategory } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;"""

new = """import { IsString, IsNumber, Min, IsDateString, IsOptional } from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  // Validated against the live expense_categories table in
  // ExpensesService.create(), not a fixed enum — see expense-categories.service.ts.
  @IsString()
  category: string;"""

if old not in content:
    raise SystemExit("create-expense.dto.ts didn't match expected content — aborting")
content = content.replace(old, new, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
