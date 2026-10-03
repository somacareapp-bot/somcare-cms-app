import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { LeaveService, Actor } from './leave.service';
import {
  CreateLeaveTypeDto,
  UpdateLeaveTypeDto,
  CreateLeaveRequestDto,
  LeaveDecisionDto,
  AdjustBalanceDto,
} from './dto/leave.dto';

const actorOf = (req: AuthenticatedRequest): Actor => ({
  id: req.user.id,
  isAdmin: !!req.user.roles?.includes('administrator'),
  avatar: req.user.profilePhoto,
});

@UseGuards(JwtAuthGuard)
@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('me')
  me(@Req() req: AuthenticatedRequest) {
    return this.leaveService.me(actorOf(req));
  }

  // ── Types ──
  @Get('types')
  getTypes(@Query('all') all?: string) {
    return this.leaveService.getTypes(all === '1' || all === 'true');
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Post('types')
  createType(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveService.createType(dto);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Patch('types/:id')
  updateType(@Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveService.updateType(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Delete('types/:id')
  deleteType(@Param('id') id: string) {
    return this.leaveService.deleteType(id);
  }

  // ── Balances ──
  @Get('balances')
  getBalances(@Req() req: AuthenticatedRequest, @Query('scope') scope?: string, @Query('year') year?: string) {
    return this.leaveService.getBalances(actorOf(req), scope ?? 'mine', year);
  }

  @UseGuards(RolesGuard)
  @Roles('administrator')
  @Post('balances/adjust')
  async adjust(@Body() dto: AdjustBalanceDto, @Req() req: AuthenticatedRequest) {
    const name = await this.leaveService.userName(req.user.id);
    return this.leaveService.adjustBalance(dto, actorOf(req), name);
  }

  // ── Requests ──
  @Get('requests')
  getRequests(@Req() req: AuthenticatedRequest, @Query('scope') scope?: string, @Query('status') status?: string) {
    return this.leaveService.getRequests(actorOf(req), scope ?? 'mine', status);
  }

  @Post('requests')
  create(@Body() dto: CreateLeaveRequestDto, @Req() req: AuthenticatedRequest) {
    return this.leaveService.createRequest(dto, actorOf(req));
  }

  @Patch('requests/:id/cancel')
  cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.leaveService.cancelRequest(id, actorOf(req));
  }

  // Not gated by @Roles — the service checks the caller is this request's approver (or admin).
  @Patch('requests/:id/decision')
  async decide(@Param('id') id: string, @Body() dto: LeaveDecisionDto, @Req() req: AuthenticatedRequest) {
    const name = await this.leaveService.userName(req.user.id);
    return this.leaveService.decide(id, dto, actorOf(req), name);
  }

  // ── Approvals queue / history ──
  @Get('approvals')
  approvals(@Req() req: AuthenticatedRequest, @Query('view') view?: string) {
    return this.leaveService.getApprovals(actorOf(req), view ?? 'pending');
  }

  // ── Calendar ──
  @Get('calendar')
  calendar(@Query('from') from: string, @Query('to') to: string) {
    return this.leaveService.getCalendar(from, to);
  }
}
