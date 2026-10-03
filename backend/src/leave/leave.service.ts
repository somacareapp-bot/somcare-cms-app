import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { LeaveType } from './entities/leave-type.entity';
import { LeaveRequest, LeaveStatus } from './entities/leave-request.entity';
import { LeaveAdjustment } from './entities/leave-adjustment.entity';
import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';
import { OrgChartNode } from '../org-chart/entities/org-chart-node.entity';
import { ExpensesService } from '../expenses/expenses.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/notification.entity';
import {
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  CreateLeaveRequestDto,
  LeaveDecisionDto,
  AdjustBalanceDto,
} from './dto/leave.dto';

// Days of the week that don't count as leave days (0 = Sunday ... 5 = Friday, 6 = Saturday).
// Keep in sync with WEEKEND_DAYS in frontend/src/modules/leave/leaveShared.tsx.
export const WEEKEND_DAYS = [5];

export interface Actor {
  id: string;
  isAdmin: boolean;
  avatar?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const toUtc = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const isRealDate = (s: string) => DATE_RE.test(s) && toUtc(s).toISOString().slice(0, 10) === s;
const fmtRange = (s: string, e: string) => (s === e ? s : `${s} to ${e}`);
const round2 = (n: number) => Math.round(n * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);
const fullName = (u: User) => `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || (u as any).username || 'Unknown';

export function countLeaveDays(start: string, end: string): number {
  let n = 0;
  const last = toUtc(end).getTime();
  for (let t = toUtc(start).getTime(); t <= last; t += 86400000) {
    if (!WEEKEND_DAYS.includes(new Date(t).getUTCDay())) n++;
  }
  return n;
}

export interface BalanceRow {
  userId: string;
  userName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  color: string;
  isUnlimited: boolean;
  accrualPerMonth: number;
  accrued: number;
  adjustment: number;
  used: number;
  pending: number;
  available: number | null; // null = unlimited
}

@Injectable()
export class LeaveService implements OnModuleInit {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    @InjectRepository(LeaveType) private readonly typeRepo: Repository<LeaveType>,
    @InjectRepository(LeaveRequest) private readonly requestRepo: Repository<LeaveRequest>,
    @InjectRepository(LeaveAdjustment) private readonly adjRepo: Repository<LeaveAdjustment>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(OrgChartNode) private readonly orgRepo: Repository<OrgChartNode>,
    private readonly expensesService: ExpensesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ── Notifications (never allowed to break the leave action itself) ───────
  private async adminIds(): Promise<string[]> {
    try {
      const users = await this.usersRepo.find({ relations: ['roles'] } as any);
      return users
        .filter((u) => ((u as any).roles ?? []).some((r: any) => String(r?.name).toLowerCase() === 'administrator'))
        .filter((u) => !['inactive', 'suspended', 'deleted', 'terminated'].includes(String((u as any).status).toLowerCase()))
        .map((u) => u.id);
    } catch (e) {
      this.logger.warn(`Could not look up administrators: ${(e as Error).message}`);
      return [];
    }
  }

  private async notify(
    recipients: Array<string | null | undefined>,
    actor: { id: string; name: string; avatar?: string },
    message: string,
    link: string,
    meta: Record<string, any>,
  ) {
    const ids = Array.from(new Set(recipients.filter((x): x is string => !!x))).filter((id) => id !== actor.id);
    if (ids.length === 0) return;

    // Always use the sender's current profile photo from their user record.
    let avatar = actor.avatar;
    try {
      const sender = await this.usersRepo.findOne({ where: { id: actor.id } });
      if (sender?.profilePhoto) avatar = sender.profilePhoto;
    } catch {
      /* fall back to whatever the request carried */
    }

    for (const recipientId of ids) {
      try {
        await this.notificationsService.create({
          recipientId,
          actorName: actor.name,
          actorAvatarUrl: avatar,
          type: NotificationType.SYSTEM,
          message,
          link,
          meta,
        } as any);
      } catch (e) {
        this.logger.warn(`Leave notification failed for ${recipientId}: ${(e as Error).message}`);
      }
    }
  }

  // ── Seed sensible defaults on first boot ─────────────────────────────────
  async onModuleInit() {
    try {
      if ((await this.typeRepo.count()) > 0) return;
      await this.typeRepo.save([
        { name: 'Annual Leave', accrualPerMonth: 2, isPaid: true, isUnlimited: false, color: '#3b82f6', description: 'Earned monthly' },
        { name: 'Sick Leave', accrualPerMonth: 1, isPaid: true, isUnlimited: false, color: '#ef4444', description: 'Earned monthly' },
        { name: 'Maternity Leave', accrualPerMonth: 0, maxDaysPerRequest: 90, isPaid: true, isUnlimited: true, color: '#ec4899' },
        { name: 'Compassionate Leave', accrualPerMonth: 0, maxDaysPerRequest: 5, isPaid: true, isUnlimited: true, color: '#8b5cf6' },
        { name: 'Unpaid Leave', accrualPerMonth: 0, isPaid: false, isUnlimited: true, color: '#6b7280' },
      ] as any);
      this.logger.log('Seeded default leave types');
    } catch (e) {
      this.logger.warn(`Leave type seeding skipped: ${(e as Error).message}`);
    }
  }

  // ── Who am I ─────────────────────────────────────────────────────────────
  async me(actor: Actor) {
    const [boxes, heads, reviewed] = await Promise.all([
      this.orgRepo.count({ where: { linkedUserId: actor.id } }),
      this.usersRepo.manager.getRepository(Department).count({ where: { headDoctorId: actor.id } as any }),
      this.requestRepo.count({ where: { approverId: actor.id } }),
    ]);
    return {
      userId: actor.id,
      isAdmin: actor.isAdmin,
      isApprover: actor.isAdmin || boxes + heads + reviewed > 0,
    };
  }

  // ── Leave types ──────────────────────────────────────────────────────────
  getTypes(includeInactive: boolean) {
    return this.typeRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { name: 'ASC' },
    });
  }

  async createType(dto: CreateLeaveTypeDto) {
    const name = dto.name.trim();
    const dup = await this.typeRepo
      .createQueryBuilder('t')
      .where('LOWER(t.name) = LOWER(:name)', { name })
      .getCount();
    if (dup) throw new BadRequestException('A leave type with that name already exists');
    const entity = this.typeRepo.create({ ...dto, name } as any) as unknown as LeaveType;
    return this.typeRepo.save(entity);
  }

  async updateType(id: string, dto: UpdateLeaveTypeDto) {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Leave type not found');
    if (dto.name && dto.name.trim().toLowerCase() !== type.name.toLowerCase()) {
      const dup = await this.typeRepo
        .createQueryBuilder('t')
        .where('LOWER(t.name) = LOWER(:name)', { name: dto.name.trim() })
        .getCount();
      if (dup) throw new BadRequestException('A leave type with that name already exists');
    }
    Object.assign(type, dto, dto.name ? { name: dto.name.trim() } : {});
    return this.typeRepo.save(type);
  }

  // Types that already have requests are deactivated instead of deleted.
  async deleteType(id: string) {
    const type = await this.typeRepo.findOne({ where: { id } });
    if (!type) throw new NotFoundException('Leave type not found');
    const used = await this.requestRepo.count({ where: { leaveTypeId: id } });
    if (used > 0) {
      type.isActive = false;
      await this.typeRepo.save(type);
      return { deleted: false, deactivated: true };
    }
    await this.adjRepo.delete({ leaveTypeId: id });
    await this.typeRepo.remove(type);
    return { deleted: true, deactivated: false };
  }

  // ── Balances (accrued on the fly, so no cron job to fail) ────────────────
  private accruedFor(type: LeaveType, year: number): number {
    if (type.isUnlimited) return 0;
    const now = new Date();
    const curYear = now.getUTCFullYear();
    const months = year < curYear ? 12 : year === curYear ? now.getUTCMonth() + 1 : 0;
    let accrued = months * Number(type.accrualPerMonth || 0);
    if (type.maxDaysPerYear != null) accrued = Math.min(accrued, Number(type.maxDaysPerYear));
    return round2(accrued);
  }

  private async computeBalances(users: User[], year: number): Promise<BalanceRow[]> {
    const types = await this.typeRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
    if (!users.length || !types.length) return [];
    const ids = users.map((u) => u.id);
    const [reqs, adjs] = await Promise.all([
      this.requestRepo
        .createQueryBuilder('r')
        .where('r.userId IN (:...ids)', { ids })
        .andWhere('r.status IN (:...st)', { st: [LeaveStatus.PENDING, LeaveStatus.APPROVED] })
        .andWhere('r.startDate >= :from AND r.startDate <= :to', { from: `${year}-01-01`, to: `${year}-12-31` })
        .getMany(),
      this.adjRepo.find({ where: { userId: In(ids), year } }),
    ]);

    const rows: BalanceRow[] = [];
    for (const u of users) {
      for (const t of types) {
        const mine = reqs.filter((r) => r.userId === u.id && r.leaveTypeId === t.id);
        const used = round2(mine.filter((r) => r.status === LeaveStatus.APPROVED).reduce((s, r) => s + Number(r.days), 0));
        const pending = round2(mine.filter((r) => r.status === LeaveStatus.PENDING).reduce((s, r) => s + Number(r.days), 0));
        const adjustment = round2(
          adjs.filter((a) => a.userId === u.id && a.leaveTypeId === t.id).reduce((s, a) => s + Number(a.days), 0),
        );
        const accrued = this.accruedFor(t, year);
        rows.push({
          userId: u.id,
          userName: fullName(u),
          leaveTypeId: t.id,
          leaveTypeName: t.name,
          color: t.color,
          isUnlimited: t.isUnlimited,
          accrualPerMonth: Number(t.accrualPerMonth || 0),
          accrued,
          adjustment,
          used,
          pending,
          available: t.isUnlimited ? null : round2(accrued + adjustment - used - pending),
        });
      }
    }
    return rows;
  }

  async getBalances(actor: Actor, scope: string, yearParam?: string) {
    const year = Number(yearParam) || new Date().getUTCFullYear();
    let users: User[];
    if (scope === 'all') {
      if (!actor.isAdmin) throw new ForbiddenException('Only administrators can view everyone\'s balances');
      const all = await this.usersRepo.find();
      users = all.filter((u) => !['inactive', 'suspended', 'deleted', 'terminated'].includes(String((u as any).status).toLowerCase()));
      users.sort((a, b) => fullName(a).localeCompare(fullName(b)));
    } else {
      const u = await this.usersRepo.findOne({ where: { id: actor.id } });
      users = u ? [u] : [];
    }
    return { year, rows: await this.computeBalances(users, year) };
  }

  async adjustBalance(dto: AdjustBalanceDto, actor: Actor, actorName: string) {
    if (!dto.days) throw new BadRequestException('Adjustment cannot be zero');
    const [user, type] = await Promise.all([
      this.usersRepo.findOne({ where: { id: dto.userId } }),
      this.typeRepo.findOne({ where: { id: dto.leaveTypeId } }),
    ]);
    if (!user) throw new NotFoundException('Staff member not found');
    if (!type) throw new NotFoundException('Leave type not found');
    const adj = this.adjRepo.create({
      userId: dto.userId,
      leaveTypeId: dto.leaveTypeId,
      year: dto.year,
      days: dto.days,
      note: dto.note ?? null,
      createdById: actor.id,
      createdByName: actorName,
    });
    const saved = await this.adjRepo.save(adj);
    const sign = dto.days > 0 ? '+' : '';
    await this.notify(
      [dto.userId],
      { id: actor.id, name: actorName, avatar: actor.avatar },
      `${actorName} adjusted your ${type.name} balance by ${sign}${dto.days} day(s) for ${dto.year}${dto.note ? `: ${dto.note}` : ''}`,
      '/leave/balance',
      { leaveTypeId: type.id, year: dto.year },
    );
    return saved;
  }

  // ── Requests ─────────────────────────────────────────────────────────────
  async createRequest(dto: CreateLeaveRequestDto, actor: Actor) {
    const user = await this.usersRepo.findOne({ where: { id: actor.id } });
    if (!user) throw new NotFoundException('User not found');

    const type = await this.typeRepo.findOne({ where: { id: dto.leaveTypeId } });
    if (!type || !type.isActive) throw new BadRequestException('Choose a valid leave type');

    if (!isRealDate(dto.startDate) || !isRealDate(dto.endDate)) throw new BadRequestException('Invalid dates');
    if (dto.endDate < dto.startDate) throw new BadRequestException('End date cannot be before start date');
    if (dto.startDate.slice(0, 4) !== dto.endDate.slice(0, 4)) {
      throw new BadRequestException('A request must be within one calendar year — please submit two requests');
    }

    const days = countLeaveDays(dto.startDate, dto.endDate);
    if (days <= 0) throw new BadRequestException('The selected dates contain no working days');
    if (type.maxDaysPerRequest != null && days > Number(type.maxDaysPerRequest)) {
      throw new BadRequestException(`${type.name} is limited to ${type.maxDaysPerRequest} days per request`);
    }

    const existing = await this.requestRepo.find({
      where: { userId: actor.id, status: In([LeaveStatus.PENDING, LeaveStatus.APPROVED]) },
    });
    const clash = existing.find((r) => r.startDate <= dto.endDate && r.endDate >= dto.startDate);
    if (clash) throw new BadRequestException('You already have a leave request covering some of those dates');

    if (!type.isUnlimited) {
      const year = Number(dto.startDate.slice(0, 4));
      const { rows } = await this.getBalances(actor, 'mine', String(year));
      const row = rows.find((r) => r.leaveTypeId === type.id);
      const available = row?.available ?? 0;
      if (days > available) {
        throw new BadRequestException(`Not enough ${type.name} balance: ${available} day(s) available, ${days} requested`);
      }
    }

    let approverId = await this.expensesService.resolveApproverId(actor.id);
    if (approverId === actor.id) approverId = null;
    let approverName: string | null = null;
    if (approverId) {
      const approver = await this.usersRepo.findOne({ where: { id: approverId } });
      approverName = approver ? fullName(approver) : null;
      if (!approver) approverId = null;
    }

    const entity = this.requestRepo.create({
      userId: actor.id,
      userName: fullName(user),
      leaveTypeId: type.id,
      startDate: dto.startDate,
      endDate: dto.endDate,
      days,
      reason: dto.reason?.trim() || null,
      status: LeaveStatus.PENDING,
      approverId,
      approverName,
    });
    const saved = await this.requestRepo.save(entity);
    saved.leaveType = type;

    // Tell the approver (or every administrator when nobody is linked).
    const recipients = approverId ? [approverId] : await this.adminIds();
    await this.notify(
      recipients,
      { id: actor.id, name: fullName(user), avatar: actor.avatar },
      `${fullName(user)} requested ${days} day(s) of ${type.name}: ${fmtRange(dto.startDate, dto.endDate)}`,
      '/leave/approvals',
      { leaveRequestId: saved.id },
    );
    return saved;
  }

  async getRequests(actor: Actor, scope: string, status?: string) {
    const where: any = {};
    if (scope === 'all') {
      if (!actor.isAdmin) throw new ForbiddenException('Only administrators can view all requests');
    } else {
      where.userId = actor.id;
    }
    if (status) where.status = status;
    return this.requestRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async cancelRequest(id: string, actor: Actor) {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.userId !== actor.id && !actor.isAdmin) throw new ForbiddenException('You can only cancel your own requests');
    const cancellable =
      req.status === LeaveStatus.PENDING ||
      (req.status === LeaveStatus.APPROVED && req.startDate >= todayIso());
    if (!cancellable) throw new BadRequestException('This request can no longer be cancelled');
    req.status = LeaveStatus.CANCELLED;
    const saved = await this.requestRepo.save(req);

    const me = { id: actor.id, name: await this.userName(actor.id), avatar: actor.avatar };
    const what = `${req.leaveType?.name ?? 'leave'} request (${fmtRange(req.startDate, req.endDate)})`;
    if (req.userId === actor.id) {
      const to = req.approverId ? [req.approverId] : await this.adminIds();
      await this.notify(to, me, `${me.name} cancelled their ${what}`, '/leave/approvals', { leaveRequestId: req.id });
    } else {
      await this.notify([req.userId], me, `${me.name} cancelled your ${what}`, '/leave/requests', { leaveRequestId: req.id });
    }
    return saved;
  }

  // ── Approvals ────────────────────────────────────────────────────────────
  async getApprovals(actor: Actor, view: string) {
    const qb = this.requestRepo.createQueryBuilder('r').leftJoinAndSelect('r.leaveType', 't');
    if (view === 'decided') {
      qb.where('r.status IN (:...st)', { st: [LeaveStatus.APPROVED, LeaveStatus.REJECTED] });
      if (!actor.isAdmin) qb.andWhere('r.decidedById = :uid', { uid: actor.id });
      qb.orderBy('r.decidedAt', 'DESC');
    } else {
      qb.where('r.status = :st', { st: LeaveStatus.PENDING });
      if (!actor.isAdmin) qb.andWhere('r.approverId = :uid', { uid: actor.id });
      qb.orderBy('r.createdAt', 'ASC');
    }
    return qb.getMany();
  }

  async decide(id: string, dto: LeaveDecisionDto, actor: Actor, actorName: string) {
    const req = await this.requestRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Leave request not found');
    if (req.status !== LeaveStatus.PENDING) throw new BadRequestException('This request has already been handled');
    if (req.userId === actor.id && !actor.isAdmin) throw new ForbiddenException('You cannot approve your own leave');
    if (!actor.isAdmin && req.approverId !== actor.id) {
      throw new ForbiddenException('You are not the approver for this request');
    }

    if (dto.decision === 'reject') {
      if (!dto.note?.trim()) throw new BadRequestException('Please give a reason for rejecting');
    } else if (!req.leaveType.isUnlimited) {
      // Balance may have changed since submission (adjustments). This request's own days
      // are already counted as pending, so an overdrawn total means it no longer fits.
      const year = Number(req.startDate.slice(0, 4));
      const owner = await this.usersRepo.findOne({ where: { id: req.userId } });
      if (owner) {
        const rows = await this.computeBalances([owner], year);
        const row = rows.find((r) => r.leaveTypeId === req.leaveTypeId);
        if (row && row.available !== null && row.available < 0) {
          throw new BadRequestException('The balance no longer covers this request');
        }
      }
    }

    req.status = dto.decision === 'approve' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;
    req.decidedById = actor.id;
    req.decidedByName = actorName;
    req.decisionNote = dto.note?.trim() || null;
    req.decidedAt = new Date();
    const saved = await this.requestRepo.save(req);

    const verb = dto.decision === 'approve' ? 'approved' : 'rejected';
    const note = dto.note?.trim() ? ` — "${dto.note.trim()}"` : '';
    await this.notify(
      [req.userId],
      { id: actor.id, name: actorName, avatar: actor.avatar },
      `${actorName} ${verb} your ${req.leaveType?.name ?? 'leave'} request (${fmtRange(req.startDate, req.endDate)})${note}`,
      '/leave/requests',
      { leaveRequestId: req.id },
    );
    return saved;
  }

  // ── Calendar ─────────────────────────────────────────────────────────────
  async getCalendar(from: string, to: string) {
    if (!isRealDate(from) || !isRealDate(to)) throw new BadRequestException('from/to must be YYYY-MM-DD');
    const list = await this.requestRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.leaveType', 't')
      .where('r.status IN (:...st)', { st: [LeaveStatus.PENDING, LeaveStatus.APPROVED] })
      .andWhere('r.startDate <= :to AND r.endDate >= :from', { from, to })
      .orderBy('r.startDate', 'ASC')
      .getMany();
    return list.map((r) => ({
      id: r.id,
      userId: r.userId,
      userName: r.userName,
      leaveTypeId: r.leaveTypeId,
      leaveTypeName: r.leaveType?.name ?? '',
      color: r.leaveType?.color ?? '#3b82f6',
      startDate: r.startDate,
      endDate: r.endDate,
      days: Number(r.days),
      status: r.status,
    }));
  }

  async userName(userId: string): Promise<string> {
    const u = await this.usersRepo.findOne({ where: { id: userId } });
    return u ? fullName(u) : 'Unknown';
  }
}
