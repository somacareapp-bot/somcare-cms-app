import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ReportsService } from './reports.service';
import { isDoctorScoped } from '../auth/utils/scope.util';

function isAdmin(user: any): boolean {
  if (!user) return false;
  const roles: string[] = user.roles ?? [];
  const ADMIN_ROLES = [
    'admin', 'superadmin', 'administrator',
    'ceo', 'medical_director', 'chief_nursing_officer', 'chief_admin_officer', 'manager',
  ];
  return roles.some(r => ADMIN_ROLES.includes(r.toLowerCase()));
}

function hasRole(user: any, roleNames: string[]): boolean {
  if (!user) return false;
  const roles: string[] = user.roles ?? [];
  return roles.some(r => roleNames.includes(r.toLowerCase()));
}

@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // No PermissionsGuard here — every authenticated role gets their own dashboard
  @Get('dashboard')
  getDashboard(@Request() req: any) {
    if (isAdmin(req.user))                         return this.reportsService.getAdminDashboard();
    if (isDoctorScoped(req.user))                  return this.reportsService.getDoctorDashboard(req.user.id);
    if (hasRole(req.user, ['nurse']))              return this.reportsService.getNurseDashboard();
    if (hasRole(req.user, ['receptionist']))       return this.reportsService.getReceptionistDashboard();
    if (hasRole(req.user, ['pharmacist']))         return this.reportsService.getPharmacistDashboard();
    if (hasRole(req.user, ['accountant']))         return this.reportsService.getAccountantDashboard();
    if (hasRole(req.user, ['laboratory']))         return this.reportsService.getLaboratoryDashboard();
    return this.reportsService.getFacilityDashboard();
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('admin-dashboard')
  getAdminDashboard() {
    return this.reportsService.getAdminDashboard();
  }

  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @Get('profit-loss')
  getProfitLoss(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getProfitLoss(from, to);
  }

  // ───────────────────────── Monthly reports (?month=YYYY-MM) ─────────────────────────

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/visits')
  getMonthlyVisits(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyVisitsReport(from, to);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/expenses')
  getMonthlyExpenses(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyExpensesReport(from, to);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/lab-supplies')
  getMonthlyLabSupplies(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyLabSuppliesReport(from, to);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/staff-activity')
  getMonthlyStaffActivity(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyStaffActivityReport(from, to);
  }


  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/diagnosis')
  getMonthlyDiagnosis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyDiagnosisReport(from, to);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/lab-revenue')
  getMonthlyLabRevenue(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyLabRevenueReport(from, to);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/pharmacy')
  getMonthlyPharmacy(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyPharmacyReport(from, to);
  }

  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('monthly/inventory-valuation')
  getMonthlyInventoryValuation(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getMonthlyInventoryValuationReport(from, to);
  }

}
