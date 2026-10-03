path = "backend/src/expenses/expenses.service.ts"
with open(path) as f:
    content = f.read()

old_import = """import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ReviewExpenseDto, ReviewDecision } from './dto/review-expense.dto';
import { ApproveExpenseDto, ApprovalDecision } from './dto/approve-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>,
  ) {}"""

new_import = """import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ReviewExpenseDto, ReviewDecision } from './dto/review-expense.dto';
import { ApproveExpenseDto, ApprovalDecision } from './dto/approve-expense.dto';
import { ExpenseCategoriesService } from './expense-categories.service';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>,
    private readonly expenseCategoriesService: ExpenseCategoriesService,
  ) {}"""

if old_import not in content:
    raise SystemExit("expenses.service.ts constructor block didn't match — aborting")
content = content.replace(old_import, new_import, 1)

old_create = """  async create(dto: CreateExpenseDto, userId: string, userName: string) {
    const expense = this.expensesRepo.create({"""
new_create = """  async create(dto: CreateExpenseDto, userId: string, userName: string) {
    const category = await this.expenseCategoriesService.findActiveByCode(dto.category);
    if (!category) {
      throw new BadRequestException(`Unknown or inactive expense category "${dto.category}"`);
    }
    const expense = this.expensesRepo.create({"""

if old_create not in content:
    raise SystemExit("expenses.service.ts create() block didn't match — aborting")
content = content.replace(old_create, new_create, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
