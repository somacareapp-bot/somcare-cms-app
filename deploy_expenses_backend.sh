#!/bin/bash
set -e

echo "📁 Working directory: $(pwd)"

if [ ! -d "backend/src" ]; then
  echo "❌ Run this from the project root (the folder containing 'backend' and 'frontend')."
  exit 1
fi

mkdir -p backend/src/expenses/entities
mkdir -p backend/src/expenses/dto

echo "── Writing backend/src/expenses/entities/expense.entity.ts ──────────────"
cat > backend/src/expenses/entities/expense.entity.ts << 'EOF'
import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

export enum ExpenseStatus {
  PENDING = 'pending',                       // just submitted by staff
  ACCOUNTANT_CONFIRMED = 'accountant_confirmed', // accountant reviewed & confirmed
  APPROVED = 'approved',                     // admin approved
  SENT_BACK = 'sent_back',                   // admin sent back for re-review
  REJECTED = 'rejected',                     // accountant rejected outright
}

export enum ExpenseCategory {
  SUPPLIES = 'supplies',
  UTILITIES = 'utilities',
  MAINTENANCE = 'maintenance',
  TRAVEL = 'travel',
  OTHER = 'other',
}

@Entity('expenses')
export class Expense extends BaseEntity {
  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.OTHER })
  category: ExpenseCategory;

  @Column({ type: 'date' })
  date: Date;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true, name: 'receipt_url' })
  receiptUrl: string;

  @Column({ type: 'enum', enum: ExpenseStatus, default: ExpenseStatus.PENDING })
  status: ExpenseStatus;

  // Staff who submitted the expense
  @Column({ name: 'submitted_by_id' })
  submittedById: string;

  @Column({ name: 'submitted_by_name' })
  submittedByName: string;

  // Accountant review stage
  @Column({ name: 'reviewed_by_id', nullable: true })
  reviewedById: string;

  @Column({ name: 'reviewed_by_name', nullable: true })
  reviewedByName: string;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string;

  // Admin approval stage
  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;

  @Column({ name: 'approved_by_name', nullable: true })
  approvedByName: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'admin_notes', type: 'text', nullable: true })
  adminNotes: string;
}
EOF

echo "── Writing backend/src/expenses/dto/create-expense.dto.ts ───────────────"
cat > backend/src/expenses/dto/create-expense.dto.ts << 'EOF'
import { IsString, IsNumber, Min, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { ExpenseCategory } from '../entities/expense.entity';

export class CreateExpenseDto {
  @IsString()
  description: string;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  receiptUrl?: string;
}
EOF

echo "── Writing backend/src/expenses/dto/review-expense.dto.ts ───────────────"
cat > backend/src/expenses/dto/review-expense.dto.ts << 'EOF'
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ReviewDecision {
  CONFIRM = 'confirm',
  REJECT = 'reject',
}

// Accountant's decision on a pending (or sent-back) expense
export class ReviewExpenseDto {
  @IsEnum(ReviewDecision)
  decision: ReviewDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
EOF

echo "── Writing backend/src/expenses/dto/approve-expense.dto.ts ──────────────"
cat > backend/src/expenses/dto/approve-expense.dto.ts << 'EOF'
import { IsEnum, IsOptional, IsString } from 'class-validator';

export enum ApprovalDecision {
  APPROVE = 'approve',
  SEND_BACK = 'send_back',
}

// Admin's decision on an accountant-confirmed expense
export class ApproveExpenseDto {
  @IsEnum(ApprovalDecision)
  decision: ApprovalDecision;

  @IsOptional()
  @IsString()
  notes?: string;
}
EOF

echo "── Writing backend/src/expenses/expenses.service.ts ──────────────────────"
cat > backend/src/expenses/expenses.service.ts << 'EOF'
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  ) {}

  // status: filter by workflow stage (e.g. accountant's queue = 'pending',
  // admin's queue = 'accountant_confirmed'). submittedById: staff viewing their own submissions.
  async getAll(status?: string, submittedById?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (submittedById) where.submittedById = submittedById;
    return this.expensesRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getOne(id: string) {
    const expense = await this.expensesRepo.findOne({ where: { id } });
    if (!expense) throw new NotFoundException('Expense not found');
    return expense;
  }

  async create(dto: CreateExpenseDto, userId: string, userName: string) {
    const expense = this.expensesRepo.create({
      description: dto.description,
      amount: dto.amount,
      category: dto.category,
      date: new Date(dto.date),
      notes: dto.notes,
      receiptUrl: dto.receiptUrl,
      status: ExpenseStatus.PENDING,
      submittedById: userId,
      submittedByName: userName,
      createdBy: userId,
    } as any) as unknown as Expense;
    return this.expensesRepo.save(expense);
  }

  // Accountant confirms or rejects a submission (stage 2)
  async review(id: string, dto: ReviewExpenseDto, userId: string, userName: string) {
    const expense = await this.getOne(id);
    if (![ExpenseStatus.PENDING, ExpenseStatus.SENT_BACK].includes(expense.status)) {
      throw new BadRequestException('Expense is not awaiting accountant review');
    }
    expense.status =
      dto.decision === ReviewDecision.CONFIRM ? ExpenseStatus.ACCOUNTANT_CONFIRMED : ExpenseStatus.REJECTED;
    expense.reviewedById = userId;
    expense.reviewedByName = userName;
    expense.reviewedAt = new Date();
    expense.reviewNotes = dto.notes;
    expense.updatedBy = userId;
    return this.expensesRepo.save(expense);
  }

  // Admin approves or sends back an accountant-confirmed expense (stage 3)
  async approve(id: string, dto: ApproveExpenseDto, userId: string, userName: string) {
    const expense = await this.getOne(id);
    if (expense.status !== ExpenseStatus.ACCOUNTANT_CONFIRMED) {
      throw new BadRequestException('Expense is not awaiting admin approval');
    }
    expense.status =
      dto.decision === ApprovalDecision.APPROVE ? ExpenseStatus.APPROVED : ExpenseStatus.SENT_BACK;
    expense.approvedById = userId;
    expense.approvedByName = userName;
    expense.approvedAt = new Date();
    expense.adminNotes = dto.notes;
    expense.updatedBy = userId;
    return this.expensesRepo.save(expense);
  }

  async remove(id: string) {
    const expense = await this.getOne(id);
    await this.expensesRepo.remove(expense);
    return { success: true };
  }
}
EOF

echo "── Writing backend/src/expenses/expenses.controller.ts ───────────────────"
cat > backend/src/expenses/expenses.controller.ts << 'EOF'
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ReviewExpenseDto } from './dto/review-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // Any authenticated staff member can list/view — the frontend filters by
  // status/submittedById per role (staff: their own; accountant: 'pending';
  // admin: 'accountant_confirmed').
  @Get()
  getAll(@Query('status') status?: string, @Query('submittedById') submittedById?: string) {
    return this.expensesService.getAll(status, submittedById);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.expensesService.getOne(id);
  }

  // Stage 1: staff submits
  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.create(dto, req.user.id, req.user.username);
  }

  // Stage 2: accountant reviews & confirms (or rejects)
  @UseGuards(RolesGuard)
  @Roles('accountant', 'administrator')
  @Patch(':id/review')
  review(@Param('id') id: string, @Body() dto: ReviewExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.review(id, dto, req.user.id, req.user.username);
  }

  // Stage 3: admin approves (or sends back to accountant)
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.approve(id, dto, req.user.id, req.user.username);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
EOF

echo "── Writing backend/src/expenses/expenses.module.ts ────────────────────────"
cat > backend/src/expenses/expenses.module.ts << 'EOF'
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from './entities/expense.entity';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Expense])],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class ExpensesModule {}
EOF

echo "── Registering ExpensesModule in app.module.ts ────────────────────────────"
cp backend/src/app.module.ts backend/src/app.module.ts.bak

python3 << 'PYEOF'
path = "backend/src/app.module.ts"
with open(path) as f:
    content = f.read()

old_import = "import { SearchModule } from './search/search.module';"
new_import = old_import + "\nimport { ExpensesModule } from './expenses/expenses.module';"
if old_import not in content:
    raise SystemExit("❌ Could not find SearchModule import line in app.module.ts — no changes made.")
if new_import not in content:
    content = content.replace(old_import, new_import, 1)

old_list = "    SearchModule,\n  ],"
new_list = "    SearchModule,\n    ExpensesModule,\n  ],"
if "ExpensesModule," not in content.split("imports: [")[1]:
    if old_list not in content:
        raise SystemExit("❌ Could not find SearchModule in the imports array — no changes made.")
    content = content.replace(old_list, new_list, 1)

with open(path, "w") as f:
    f.write(content)
print("✅ app.module.ts updated (backup at app.module.ts.bak)")
PYEOF

echo "── Adding expensesApi to frontend/src/services/api.ts ─────────────────────"
cp frontend/src/services/api.ts frontend/src/services/api.ts.bak

python3 << 'PYEOF'
path = "frontend/src/services/api.ts"
with open(path) as f:
    content = f.read()

if "export const expensesApi" in content:
    print("ℹ️  expensesApi already present — skipping.")
else:
    anchor = """export const billingApi = {
  getVisitSummary: (visitId: string) => api.get(`/api/billing/visit-summary/${visitId}`),
  getAll: (patientId?: string, search?: string) => api.get('/api/billing/invoices', { params: { patientId, search } }),
  getOne: (id: string) => api.get(`/api/billing/invoices/${id}`),
  create: (data: any) => api.post('/api/billing/invoices', data),
  recordPayment: (id: string, amount: number) =>
    api.post(`/api/billing/invoices/${id}/payments`, { amount }),
  remove: (id: string) => api.delete(`/api/billing/invoices/${id}`),
  getAllPayments: () => api.get('/api/billing/payments'),
};"""

    addition = """

export const expensesApi = {
  getAll: (status?: string, submittedById?: string) =>
    api.get('/api/expenses', { params: { status, submittedById } }),
  getOne: (id: string) => api.get(`/api/expenses/${id}`),
  create: (data: any) => api.post('/api/expenses', data),
  review: (id: string, decision: 'confirm' | 'reject', notes?: string) =>
    api.patch(`/api/expenses/${id}/review`, { decision, notes }),
  approve: (id: string, decision: 'approve' | 'send_back', notes?: string) =>
    api.patch(`/api/expenses/${id}/approve`, { decision, notes }),
  remove: (id: string) => api.delete(`/api/expenses/${id}`),
};"""

    if anchor not in content:
        raise SystemExit("❌ Could not find billingApi block in api.ts — no changes made.")
    content = content.replace(anchor, anchor + addition, 1)
    with open(path, "w") as f:
        f.write(content)
    print("✅ api.ts updated (backup at api.ts.bak)")
PYEOF

echo ""
echo "🎉 Done. Backend Expenses module created and registered; frontend expensesApi added."
echo ""
echo "Next steps:"
echo "  1. cd backend && npm run start:dev   (synchronize:true in dev will create the 'expenses' table automatically)"
echo "  2. Update your Expenses UI components to call expensesApi.* instead of localStorage.getItem/setItem"
echo "  3. Restart the frontend dev server"
