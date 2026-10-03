import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { DeptHeadReviewExpenseDto } from './dto/dept-head-review-expense.dto';
import { ApproveExpenseDto } from './dto/approve-expense.dto';
import { MarkPaidExpenseDto } from './dto/mark-paid-expense.dto';

@UseGuards(JwtAuthGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // Any authenticated staff member can list/view — the frontend filters by
  // status/submittedById per role.
  @Get()
  getAll(@Query('status') status?: string, @Query('submittedById') submittedById?: string) {
    return this.expensesService.getAll(status, submittedById);
  }

  // Must be declared before ':id' so "dept-head-queue" is not captured as an id.
  @Get('dept-head-queue')
  getDeptHeadQueue(@Req() req: AuthenticatedRequest) {
    const isAdmin = !!req.user.roles?.includes('administrator');
    return this.expensesService.getDeptHeadQueue(req.user.id, isAdmin);
  }

  // True when the caller is linked to an org chart box (a head). Drives the
  // "Awaiting My Review" tab. Declared before ':id'.
  @Get('is-approver')
  isApprover(@Req() req: AuthenticatedRequest) {
    return this.expensesService.isApprover(req.user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.expensesService.getOne(id);
  }

  // Stage 1: staff submits
  @Post()
  create(@Body() dto: CreateExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.create(dto, req.user.id, req.user.fullName, req.user.profilePhoto);
  }

  // Stage 1.5: department head approves or rejects (or admin overrides).
  // Not gated by @Roles — any authenticated user may attempt it; the service
  // enforces "must be this submitter's actual department head, or admin."
  @Patch(':id/dept-head-review')
  deptHeadReview(@Param('id') id: string, @Body() dto: DeptHeadReviewExpenseDto, @Req() req: AuthenticatedRequest) {
    const isAdmin = !!req.user.roles?.includes('administrator');
    return this.expensesService.deptHeadReview(id, dto, req.user.id, req.user.fullName, req.user.profilePhoto, isAdmin);
  }

  // Stage 2: admin gives final approval (or rejects)
  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch(':id/approve')
  approve(@Param('id') id: string, @Body() dto: ApproveExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.approve(id, dto, req.user.id, req.user.fullName, req.user.profilePhoto);
  }

  // Stage 3: accountant (or admin) marks an approved expense as paid
  @UseGuards(RolesGuard)
  @Roles('accountant', 'administrator')
  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string, @Body() dto: MarkPaidExpenseDto, @Req() req: AuthenticatedRequest) {
    return this.expensesService.markPaid(id, dto, req.user.id, req.user.fullName);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.expensesService.remove(id);
  }
}
