import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Expense, ExpenseStatus } from './entities/expense.entity';
import { User, UserStatus } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { DeptHeadReviewExpenseDto, DeptHeadDecision } from './dto/dept-head-review-expense.dto';
import { ApproveExpenseDto, ApprovalDecision } from './dto/approve-expense.dto';
import { MarkPaidExpenseDto } from './dto/mark-paid-expense.dto';
import { ExpenseCategoriesService } from './expense-categories.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import { UsersService } from '../users/users.service';
import { OrgChartNode } from '../org-chart/entities/org-chart-node.entity';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense) private readonly expensesRepo: Repository<Expense>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(OrgChartNode) private readonly orgChartRepo: Repository<OrgChartNode>,
    private readonly expenseCategoriesService: ExpenseCategoriesService,
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  // status: filter by workflow stage. submittedById: staff viewing their own submissions.
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

  // Expenses in PENDING status where the caller is the resolved next
  // approver in the chain of command for the submitter (or is an admin,
  // who may act at any stage).
  async getDeptHeadQueue(userId: string, isAdmin: boolean) {
    const pending = await this.expensesRepo.find({
      where: { status: ExpenseStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (pending.length === 0) return [];
    if (isAdmin) return pending;

    const results: Expense[] = [];
    for (const e of pending) {
      const approverId = await this.resolveApproverId(e.submittedById);
      if (approverId === userId) results.push(e);
    }
    return results;
  }

  // ── Org-tree approval routing ────────────────────────────────────────────
  // Order:
  //  1. A person linked to the submitter's own group box (group box with a person:
  //     e.g. one person on the "Doctors" box approves every doctor).
  //  2. Otherwise the head of the submitter's own department (Departments page).
  //  3. Otherwise the first linked person walking up the org chart.
  //  4. Nobody found -> null (admin handles it).
  async resolveApproverId(submittedById: string): Promise<string | null> {
    const [nodes, user] = await Promise.all([
      this.orgChartRepo.find(),
      this.usersRepo.findOne({ where: { id: submittedById }, relations: ['roles'] }),
    ]);
    if (!user) return null;
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // Find the submitter's box: their own (they are the linked person), else the
    // box their department / position / role is linked to.
    let start: OrgChartNode | undefined;
    let ownBox = false;
    const own = nodes.find((n) => n.linkedUserId === submittedById);
    if (own) {
      start = own;
      ownBox = true;
    } else {
      const position = (user.position || '').trim().toLowerCase();
      const roleKeys = new Set<string>(
        ((user as any).roles ?? []).flatMap((r: any) => [r.id, r.name]).filter(Boolean),
      );
      const linked = nodes.filter((n) => n.linkType && n.linkValue && String(n.status) === 'active');
      start =
        linked.find((n) => n.linkType === 'department' && !!user.departmentId && n.linkValue === user.departmentId) ??
        linked.find((n) => n.linkType === 'position' && !!position && (n.linkValue as string).trim().toLowerCase() === position) ??
        linked.find((n) => n.linkType === 'role' && roleKeys.has(n.linkValue as string));
    }
    // 1. A person set on the submitter's group box approves everyone in it.
    if (start && !ownBox && start.linkedUserId) return start.linkedUserId;

    // 2. Their own department head (the head themselves skips this).
    if (user.departmentId) {
      const dept = await this.usersRepo.manager
        .getRepository(Department)
        .findOne({ where: { id: user.departmentId } });
      if (dept?.headDoctorId && dept.headDoctorId !== submittedById) return dept.headDoctorId;
    }
    // 3. Walk up the org chart.
    if (!start) return null;
    let current: OrgChartNode | undefined = ownBox
      ? (start.parentId ? byId.get(start.parentId) : undefined)
      : start;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.linkedUserId && current.linkedUserId !== submittedById) return current.linkedUserId;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return null;
  }

  async isApprover(userId: string): Promise<boolean> {
    if ((await this.orgChartRepo.count({ where: { linkedUserId: userId } })) > 0) return true;
    return (await this.usersRepo.manager.getRepository(Department).count({ where: { headDoctorId: userId } })) > 0;
  }

  // Notify everyone holding any of the given roles, always including
  // administrators regardless of which roles were asked for.
  private async notifyRoles(roleNames: string[], opts: { actorName: string; actorAvatarUrl?: string; message: string; link?: string; meta?: Record<string, any> }) {
    const targetRoles = Array.from(new Set([...roleNames, 'administrator']));
    const users = await this.usersService.findByRoleNames(targetRoles);
    await Promise.all(
      users.map((u) =>
        this.notificationsService.create({
          recipientId: u.id,
          actorName: opts.actorName,
          actorAvatarUrl: opts.actorAvatarUrl,
          type: NotificationType.EXPENSE,
          message: opts.message,
          link: opts.link,
          meta: opts.meta,
        }),
      ),
    );
  }

  private async notifyUser(recipientId: string, opts: { actorName: string; actorAvatarUrl?: string; message: string; link?: string; meta?: Record<string, any> }) {
    await this.notificationsService.create({
      recipientId,
      actorName: opts.actorName,
      actorAvatarUrl: opts.actorAvatarUrl,
      type: NotificationType.EXPENSE,
      message: opts.message,
      link: opts.link,
      meta: opts.meta,
    });
  }

  async create(dto: CreateExpenseDto, userId: string, userName: string, userAvatar?: string) {
    const category = await this.expenseCategoriesService.findActiveByCode(dto.category);
    if (!category) {
      throw new BadRequestException(`Unknown or inactive expense category "${dto.category}"`);
    }
    const deptHeadId = await this.resolveApproverId(userId);
    // Auto-skip the dept-head stage when there's no head to route to.
    const initialStatus = deptHeadId ? ExpenseStatus.PENDING : ExpenseStatus.DEPT_HEAD_APPROVED;

    const expense = this.expensesRepo.create({
      description: dto.description,
      amount: dto.amount,
      category: dto.category,
      date: new Date(dto.date),
      notes: dto.notes,
      receiptUrl: dto.receiptUrl,
      status: initialStatus,
      submittedById: userId,
      submittedByName: userName,
      deptHeadAutoSkipped: !deptHeadId,
      createdBy: userId,
    } as any) as unknown as Expense;
    const saved = await this.expensesRepo.save(expense);

    if (deptHeadId) {
      // Stage 1: notify the department head directly.
      await this.notifyUser(deptHeadId, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} submitted an expense for your approval: ${dto.description} (${dto.amount})`,
        link: '/billing/expenses',
        meta: { expenseId: saved.id },
      });
    } else {
      // Auto-skipped straight past dept-head stage: notify admins now.
      await this.notifyRoles([], {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} submitted an expense: ${dto.description} (${dto.amount})`,
        link: '/billing/expenses',
        meta: { expenseId: saved.id },
      });
    }
    return saved;
  }

  // Department head approves or rejects a freshly-submitted expense (stage 1).
  // Administrators can act on behalf of any department head (override).
  async deptHeadReview(id: string, dto: DeptHeadReviewExpenseDto, userId: string, userName: string, userAvatar: string | undefined, isAdmin: boolean) {
    const expense = await this.getOne(id);
    if (expense.status !== ExpenseStatus.PENDING) {
      throw new BadRequestException('Expense is not awaiting department head review');
    }
    if (!isAdmin) {
      const approverId = await this.resolveApproverId(expense.submittedById);
      if (!approverId || approverId !== userId) {
        throw new ForbiddenException('You are not the approver for this submitter');
      }
    }

    const approved = dto.decision === DeptHeadDecision.APPROVE;
    expense.status = approved ? ExpenseStatus.DEPT_HEAD_APPROVED : ExpenseStatus.DEPT_HEAD_REJECTED;
    expense.deptHeadApprovedById = userId;
    expense.deptHeadApprovedByName = userName;
    expense.deptHeadApprovedAt = new Date();
    expense.deptHeadNotes = dto.notes ?? '';
    expense.deptHeadAutoSkipped = false;
    expense.updatedBy = userId;
    const saved = await this.expensesRepo.save(expense);

    if (approved) {
      await this.notifyUser(expense.submittedById, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} approved an expense — ready for payment: ${expense.description}`,
        link: '/billing/expenses',
        meta: { expenseId: saved.id },
      });
    } else {
      await this.notifyUser(expense.submittedById, {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: `${userName} rejected your expense: ${expense.description}`,
        link: '/billing/expenses',
        meta: { expenseId: saved.id },
      });
    }
    return saved;
  }

  // Admin approves or rejects a dept-head-approved expense (stage 2, final approval)
  async approve(id: string, dto: ApproveExpenseDto, userId: string, userName: string, userAvatar?: string) {
    const expense = await this.getOne(id);
    if (expense.status !== ExpenseStatus.DEPT_HEAD_APPROVED) {
      throw new BadRequestException('Expense is not awaiting admin approval');
    }

    // If the same person did stage 1 (dept head) and is now doing stage 2 (admin),
    // auto-approve — one sign-off is enough. Covers any role: CEO, Medical Director,
    // or anyone who is both a dept-head approver and an admin.
    const sameApprover =
      expense.deptHeadApprovedById != null &&
      expense.deptHeadApprovedById === userId &&
      expense.deptHeadAutoSkipped === false;

    const approved = sameApprover ? true : dto.decision === ApprovalDecision.APPROVE;
    expense.status = approved ? ExpenseStatus.APPROVED : ExpenseStatus.REJECTED;
    expense.approvedById = userId;
    expense.approvedByName = userName;
    expense.approvedAt = new Date();
    expense.adminNotes = sameApprover
      ? '(auto-approved: dept head and admin are the same person)'
      : (dto.notes ?? '');
    expense.updatedBy = userId;
    const saved = await this.expensesRepo.save(expense);

    const verb = approved ? 'approved' : 'rejected';
    await this.notifyUser(expense.submittedById, {
      actorName: userName,
      actorAvatarUrl: userAvatar,
      message: `${userName} ${verb} your expense: ${expense.description}`,
      link: '/billing/expenses',
      meta: { expenseId: saved.id },
    });
    return saved;
  }

  // Accountant (or admin) marks an approved expense as paid — final stage.
  async markPaid(id: string, dto: MarkPaidExpenseDto, userId: string, userName: string) {
    const expense = await this.getOne(id);
    if (expense.status !== ExpenseStatus.APPROVED) {
      throw new BadRequestException('Expense must be approved before it can be marked as paid');
    }
    expense.status = ExpenseStatus.PAID;
    expense.paidById = userId;
    expense.paidByName = userName;
    expense.paidAt = new Date();
    expense.paidNotes = dto.notes ?? '';
    expense.updatedBy = userId;
    const saved = await this.expensesRepo.save(expense);

    await this.notifyUser(expense.submittedById, {
      actorName: userName,
      message: `Your expense was marked as paid: ${expense.description}`,
      link: '/billing/expenses',
      meta: { expenseId: saved.id },
    });

    return saved;
  }

  async remove(id: string) {
    const expense = await this.getOne(id);
    await this.expensesRepo.remove(expense);
    return { success: true };
  }
}
