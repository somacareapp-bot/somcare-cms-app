import os
import pathlib

BASE = "/Users/adminnopassword/Documents/Clinical MS/cms"

files = {}

# ─────────────────────────────────────────────────────────────────────────────
# 1. BACKEND: reports.service.ts
# ─────────────────────────────────────────────────────────────────────────────
files["backend/src/reports/reports.service.ts"] = r"""
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, Not } from 'typeorm';
import { Visit, VisitStatus, VisitUrgency } from '../visits/entities/visit.entity';
import { Appointment } from '../appointments/appointment.entity';
import { Prescription, PrescriptionStatus } from '../visits/entities/prescription.entity';
import { LabOrder, LabOrderStatus } from '../laboratory/entities/lab-order.entity';
import { User } from '../users/entities/user.entity';
import { Patient } from '../patients/entities/patient.entity';
import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Invoice, InvoiceStatus } from '../billing/entities/invoice.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Visit)       private readonly visitsRepo: Repository<Visit>,
    @InjectRepository(Appointment) private readonly appointmentsRepo: Repository<Appointment>,
    @InjectRepository(Prescription) private readonly prescriptionsRepo: Repository<Prescription>,
    @InjectRepository(LabOrder)    private readonly labOrdersRepo: Repository<LabOrder>,
    @InjectRepository(User)        private readonly usersRepo: Repository<User>,
    @InjectRepository(Patient)     private readonly patientsRepo: Repository<Patient>,
    @InjectRepository(Medicine)    private readonly medicinesRepo: Repository<Medicine>,
    @InjectRepository(Invoice)     private readonly invoicesRepo: Repository<Invoice>,
  ) {}

  private todayStart() {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }

  async getAdminDashboard() {
    const today = this.todayStart();

    // ── KPIs ─────────────────────────────────────────────────────────────
    const [totalPatients, newPatientsToday] = await Promise.all([
      this.patientsRepo.count(),
      this.patientsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
    ]);

    const appointmentsToday = await this.appointmentsRepo.count({
      where: { appointmentDate: today.toISOString().split('T')[0] },
    });

    const allDoctors = await this.usersRepo.find({ where: { role: 'doctor' as any } });
    const activeDoctors = allDoctors.filter((u: any) => u.status === 'active' || u.isActive === true).length;

    const allStaff = await this.usersRepo.find();
    const activeStaff = allStaff.filter((u: any) => u.status === 'active' || u.isActive === true).length;

    // ── Clinical activity ─────────────────────────────────────────────────
    const todaysVisits = await this.visitsRepo.find({
      where: { createdAt: MoreThanOrEqual(today) },
    });
    const clinicalActivity = {
      waiting:    todaysVisits.filter(v => v.status === VisitStatus.WAITING).length,
      consulting: todaysVisits.filter(v => v.status === VisitStatus.WITH_DOCTOR).length,
      completed:  todaysVisits.filter(v => v.status === VisitStatus.COMPLETED).length,
      emergency:  todaysVisits.filter(v => v.urgency === VisitUrgency.EMERGENCY).length,
    };

    // ── Patient activity — last 10 days ───────────────────────────────────
    const patientActivity: { date: string; count: number }[] = [];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = new Date(d); next.setDate(next.getDate() + 1);
      const count = await this.visitsRepo
        .createQueryBuilder('v')
        .where('v.created_at >= :d', { d })
        .andWhere('v.created_at < :next', { next })
        .getCount();
      patientActivity.push({ date: d.toISOString().split('T')[0], count });
    }

    // ── Appointments today list ───────────────────────────────────────────
    const apptList = await this.appointmentsRepo.find({
      where: { appointmentDate: today.toISOString().split('T')[0] },
      relations: ['doctor'],
      order: { appointmentTime: 'ASC' },
      take: 6,
    });

    // ── Department performance ─────────────────────────────────────────────
    const departments = ['Internal Medicine', 'Pediatrics', 'Emergency', 'Laboratory'];
    const departmentPerformance = await Promise.all(
      departments.map(async (dept) => {
        const total = await this.visitsRepo.count({
          where: { department: dept, createdAt: MoreThanOrEqual(today) },
        });
        const completed = await this.visitsRepo.count({
          where: { department: dept, status: VisitStatus.COMPLETED, createdAt: MoreThanOrEqual(today) },
        });
        return { name: dept, pct: total > 0 ? Math.round((completed / total) * 100) : null, total, completed };
      }),
    );

    // ── Alerts ───────────────────────────────────────────────────────────
    const lowStockMeds = await this.medicinesRepo
      .createQueryBuilder('m')
      .where('m.stock_quantity <= m.reorder_level')
      .andWhere('m.is_active = true')
      .getCount()
      .catch(() => 0);

    const pendingLabs = await this.labOrdersRepo.count({ where: { status: LabOrderStatus.ORDERED } });
    const pendingPayments = await this.invoicesRepo.count({ where: { status: InvoiceStatus.UNPAID } });

    const alerts: { level: string; message: string }[] = [];
    if (lowStockMeds > 0) alerts.push({ level: 'red',    message: `${lowStockMeds} medicine${lowStockMeds > 1 ? 's' : ''} low on stock` });
    if (pendingLabs > 0)  alerts.push({ level: 'yellow', message: `${pendingLabs} pending lab test${pendingLabs > 1 ? 's' : ''}` });
    if (pendingPayments > 0) alerts.push({ level: 'blue', message: `${pendingPayments} pending payment${pendingPayments > 1 ? 's' : ''}` });

    // ── Recent activity with actor names ──────────────────────────────────
    const recentActivity: { type: string; message: string; actor?: string; time: string }[] = [];

    const newPatients = await this.patientsRepo.find({
      where: { createdAt: MoreThanOrEqual(today) },
      order: { createdAt: 'DESC' },
      take: 3,
    });
    for (const p of newPatients) {
      recentActivity.push({
        type: 'patient',
        message: `${p.firstName} ${p.lastName} registered`,
        time: (p.createdAt as Date).toISOString(),
      });
    }

    const completedVisits = await this.visitsRepo.find({
      where: { status: VisitStatus.COMPLETED, createdAt: MoreThanOrEqual(today) },
      relations: ['doctor', 'patient'],
      order: { updatedAt: 'DESC' },
      take: 4,
    });
    for (const v of completedVisits) {
      const docName = v.doctor
        ? `Dr. ${(v.doctor as any).firstName ?? ''} ${(v.doctor as any).lastName ?? ''}`.trim()
        : undefined;
      const patName = v.patient ? `${v.patient.firstName} ${v.patient.lastName}` : 'patient';
      recentActivity.push({
        type: 'visit',
        message: `Visit completed — ${patName}`,
        actor: docName,
        time: ((v as any).completedAt ?? v.updatedAt ?? v.createdAt).toISOString(),
      });
    }

    const completedLabs = await this.labOrdersRepo.find({
      where: { status: LabOrderStatus.COMPLETED, createdAt: MoreThanOrEqual(today) },
      relations: ['patient'],
      order: { updatedAt: 'DESC' },
      take: 3,
    });
    for (const l of completedLabs) {
      const patName = l.patient ? `${l.patient.firstName} ${l.patient.lastName}` : 'patient';
      recentActivity.push({
        type: 'lab',
        message: `Lab result approved — ${patName}`,
        actor: (l as any).verifiedByName ?? undefined,
        time: ((l as any).completedAt ?? l.updatedAt ?? l.createdAt).toISOString(),
      });
    }

    const dispensed = await this.prescriptionsRepo.find({
      where: { status: PrescriptionStatus.DISPENSED, createdAt: MoreThanOrEqual(today) },
      relations: ['visit', 'visit.patient'],
      order: { createdAt: 'DESC' } as any,
      take: 3,
    });
    for (const rx of dispensed) {
      const patName = rx.visit?.patient
        ? `${rx.visit.patient.firstName} ${rx.visit.patient.lastName}`
        : 'patient';
      recentActivity.push({
        type: 'pharmacy',
        message: `Prescription issued — ${patName}`,
        actor: (rx as any).dispensedByName ?? undefined,
        time: ((rx as any).dispensedAt ?? rx.createdAt).toISOString(),
      });
    }

    recentActivity.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

    return {
      kpis: {
        totalPatients,
        newPatientsToday,
        appointmentsToday,
        totalDoctors: allDoctors.length,
        activeDoctors,
        totalStaff: allStaff.length,
        activeStaff,
      },
      clinicalActivity,
      patientActivity,
      appointmentsToday: apptList.map(a => ({
        id: a.id,
        time: a.appointmentTime,
        doctorName: a.doctor
          ? `Dr. ${(a.doctor as any).firstName ?? ''} ${(a.doctor as any).lastName ?? ''}`.trim()
          : 'Unassigned',
        status: a.status,
        type: a.type,
      })),
      departmentPerformance,
      alerts,
      recentActivity: recentActivity.slice(0, 8),
    };
  }

  async getFacilityDashboard() {
    const today = this.todayStart();
    const [totalPatients, todayVisits, pendingLabs, pendingPrescriptions] = await Promise.all([
      this.patientsRepo.count(),
      this.visitsRepo.count({ where: { createdAt: MoreThanOrEqual(today) } }),
      this.labOrdersRepo.count({ where: { status: LabOrderStatus.ORDERED } }),
      this.prescriptionsRepo.count({ where: { status: PrescriptionStatus.PENDING } }),
    ]);
    return { totalPatients, todayVisits, pendingLabs, pendingPrescriptions };
  }
}
""".strip()

# ─────────────────────────────────────────────────────────────────────────────
# 2. BACKEND: reports.controller.ts
# ─────────────────────────────────────────────────────────────────────────────
files["backend/src/reports/reports.controller.ts"] = r"""
import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ReportsService } from './reports.service';

function isAdmin(user: any): boolean {
  if (!user) return false;
  const roles: string[] = user.roles ?? [];
  return roles.some(r => ['admin', 'superadmin', 'administrator'].includes(r.toLowerCase()));
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Permissions('reports:read')
  @Get('dashboard')
  getDashboard(@Request() req: any) {
    if (isAdmin(req.user)) return this.reportsService.getAdminDashboard();
    return this.reportsService.getFacilityDashboard();
  }

  @Permissions('reports:read')
  @Get('admin-dashboard')
  getAdminDashboard() {
    return this.reportsService.getAdminDashboard();
  }
}
""".strip()

# ─────────────────────────────────────────────────────────────────────────────
# 3. FRONTEND: AdminDashboardSection.tsx
# ─────────────────────────────────────────────────────────────────────────────
files["frontend/src/modules/dashboard/AdminDashboardSection.tsx"] = r"""
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Stethoscope, UserCog,
  Clock, CheckCircle2, AlertCircle, FlaskConical,
  TrendingUp, Bell, Activity,
} from 'lucide-react';
import api from '../../services/api';

const fetchAdminDashboard = () =>
  api.get('/api/reports/admin-dashboard').then(r => r.data);

function fmtTime(iso: string) {
  try { return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

const DEPT_COLORS: Record<string, string> = {
  'Internal Medicine': '#22c55e',
  'Pediatrics':        '#3b82f6',
  'Emergency':         '#a855f7',
  'Laboratory':        '#f59e0b',
};

const ALERT_DOT: Record<string, string> = {
  red:    'bg-red-500',
  yellow: 'bg-amber-400',
  blue:   'bg-blue-400',
};

function ApptDot({ status }: { status: string }) {
  const m: Record<string, string> = {
    completed: 'bg-green-500', confirmed: 'bg-blue-500',
    scheduled: 'bg-gray-300',  cancelled: 'bg-red-400',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${m[status] ?? 'bg-gray-300'}`} />;
}

function ActivityIcon({ type }: { type: string }) {
  const m: Record<string, { icon: React.ReactNode; color: string }> = {
    patient:  { icon: <Users size={13} />,        color: 'bg-blue-100 text-blue-600' },
    visit:    { icon: <Stethoscope size={13} />,  color: 'bg-green-100 text-green-600' },
    lab:      { icon: <FlaskConical size={13} />, color: 'bg-purple-100 text-purple-600' },
    pharmacy: { icon: <Activity size={13} />,     color: 'bg-amber-100 text-amber-600' },
  };
  const { icon, color } = m[type] ?? { icon: <Bell size={13} />, color: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${color}`}>
      {icon}
    </span>
  );
}

export function AdminDashboardSection() {
  const navigate = useNavigate();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: fetchAdminDashboard,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32 text-clinical-400 gap-2">
        <div className="w-5 h-5 border-2 border-clinical-200 border-t-blue-500 rounded-full animate-spin" />
        Loading dashboard…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-32 text-red-500 gap-2">
        <AlertCircle size={18} /> Failed to load dashboard data.
      </div>
    );
  }

  const { kpis, clinicalActivity, patientActivity, appointmentsToday,
          departmentPerformance, alerts, recentActivity } = data;

  const sparkValues: number[] = (patientActivity ?? []).map((d: any) => d.count);
  const sparkMax = Math.max(...sparkValues, 1);

  const kpiCards = [
    {
      label: 'Patients',
      value: kpis.totalPatients,
      sub: `+${kpis.newPatientsToday} today`,
      subGreen: kpis.newPatientsToday > 0,
      icon: <Users size={22} />,
      bg: 'bg-blue-500',
      click: () => navigate('/patients'),
    },
    {
      label: 'Appointment',
      value: kpis.appointmentsToday,
      sub: 'Today',
      icon: <Calendar size={22} />,
      bg: 'bg-green-500',
      click: () => navigate('/appointments/today'),
    },
    {
      label: 'Doctors',
      value: kpis.totalDoctors,
      sub: `↓ ${kpis.activeDoctors} Active`,
      icon: <Stethoscope size={22} />,
      bg: 'bg-purple-500',
      click: () => navigate('/staff'),
    },
    {
      label: 'Staff',
      value: kpis.totalStaff,
      sub: 'Active',
      icon: <UserCog size={22} />,
      bg: 'bg-orange-400',
      click: () => navigate('/staff'),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-clinical-900">ADMIN DASHBOARD</h1>
        <p className="text-sm text-clinical-500 mt-0.5">
          Welcome back, Administrator &nbsp;·&nbsp;{' '}
          <span className="inline-flex items-center gap-1">
            <Calendar size={13} className="text-clinical-400" />
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </span>
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(c => (
          <button
            key={c.label}
            onClick={c.click}
            className="bg-white rounded-xl border border-clinical-100 p-4 flex items-center gap-4
                       hover:shadow-md hover:border-clinical-200 transition-all text-left"
          >
            <div className={`${c.bg} text-white rounded-full w-12 h-12 flex items-center justify-center shrink-0`}>
              {c.icon}
            </div>
            <div>
              <p className="text-xs font-semibold text-clinical-500 uppercase tracking-wide">{c.label}</p>
              <p className="text-2xl font-bold text-clinical-900 leading-tight">{c.value ?? '—'}</p>
              {c.sub && (
                <p className={`text-xs mt-0.5 ${(c as any).subGreen ? 'text-green-600' : 'text-clinical-400'}`}>
                  {c.sub}
                </p>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* Row 2: Clinical Activity + Sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Clinical Activity */}
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={15} className="text-clinical-400" />
            <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">Today's Clinical Activity</h2>
          </div>
          <div className="space-y-2">
            {[
              { label: 'Waiting',    value: clinicalActivity.waiting,    dot: 'bg-amber-400',  to: '/queue' },
              { label: 'Consulting', value: clinicalActivity.consulting,  dot: 'bg-blue-500',   to: '/queue' },
              { label: 'Completed',  value: clinicalActivity.completed,   dot: 'bg-green-500',  to: '/queue' },
              { label: 'Emergency',  value: clinicalActivity.emergency,   dot: 'bg-red-500',    to: '/patients/emergency' },
            ].map(row => (
              <button
                key={row.label}
                onClick={() => navigate(row.to)}
                className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg px-2 py-2 transition-colors"
              >
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${row.dot}`} />
                <span className="flex-1 text-sm text-clinical-700 text-left">{row.label}</span>
                <span className="text-sm font-bold text-clinical-900">{row.value}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Patient Activity Sparkline */}
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={15} className="text-clinical-400" />
              <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">Patient Activity</h2>
            </div>
            <span className="text-xs text-clinical-400">Patients / Visits</span>
          </div>
          <div className="w-full" style={{ height: 80 }}>
            {sparkValues.length > 1 ? (
              <svg width="100%" height="100%" viewBox={`0 0 200 64`} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {(() => {
                  const pts = sparkValues.map((v, i) => {
                    const x = (i / (sparkValues.length - 1)) * 200;
                    const y = 60 - (v / sparkMax) * 52;
                    return `${x},${y}`;
                  }).join(' ');
                  const area = `M0,64 ` +
                    sparkValues.map((v, i) => {
                      const x = (i / (sparkValues.length - 1)) * 200;
                      const y = 60 - (v / sparkMax) * 52;
                      return `L${x},${y}`;
                    }).join(' ') + ` L200,64 Z`;
                  return (
                    <>
                      <path d={area} fill="url(#sg)" />
                      <polyline points={pts} fill="none" stroke="#3b82f6"
                        strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    </>
                  );
                })()}
              </svg>
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-clinical-400 italic">
                No visit data yet
              </div>
            )}
          </div>
          {patientActivity?.length >= 2 && (
            <div className="flex justify-between mt-1">
              <span className="text-xs text-clinical-400">
                {new Date(patientActivity[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
              <span className="text-xs text-clinical-400">
                {new Date(patientActivity[patientActivity.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Appointments + Dept Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appointments Today */}
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-clinical-400" />
              <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">Appointments Today</h2>
            </div>
            <button onClick={() => navigate('/appointments/today')}
              className="text-xs text-blue-600 hover:underline">View all</button>
          </div>
          <div className="space-y-1">
            {appointmentsToday.length === 0 ? (
              <p className="text-sm text-clinical-400 italic py-6 text-center">No appointments today</p>
            ) : appointmentsToday.map((a: any) => (
              <button key={a.id} onClick={() => navigate(`/appointments/${a.id}`)}
                className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg px-2 py-2 transition-colors text-left">
                <span className="text-xs font-mono text-clinical-500 w-14 shrink-0">
                  {a.time?.slice(0, 5) ?? '—'}
                </span>
                <span className="flex-1 text-sm text-clinical-800 truncate">{a.doctorName}</span>
                <ApptDot status={a.status} />
              </button>
            ))}
          </div>
        </div>

        {/* Department Performance */}
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-clinical-400" />
            <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">Department Performance</h2>
          </div>
          <div className="space-y-4">
            {departmentPerformance.map((d: any) => (
              <div key={d.name} className="flex items-center gap-3">
                <span className="text-sm text-clinical-700 w-36 shrink-0">{d.name}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-2.5 rounded-full transition-all duration-700"
                    style={{ width: `${d.pct ?? 0}%`, backgroundColor: DEPT_COLORS[d.name] ?? '#6b7280' }}
                  />
                </div>
                <span className="text-sm font-semibold text-clinical-800 w-10 text-right shrink-0">
                  {d.pct !== null ? `${d.pct}%` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Alerts + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* System Alerts */}
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={15} className="text-clinical-400" />
            <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">System Alerts</h2>
          </div>
          {alerts.length === 0 ? (
            <div className="flex items-center gap-2 py-4 text-green-600">
              <CheckCircle2 size={16} />
              <span className="text-sm">All systems normal</span>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((a: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ALERT_DOT[a.level] ?? 'bg-gray-400'}`} />
                  <span className="text-sm text-clinical-700">{a.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={15} className="text-clinical-400" />
            <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">Recent Activity</h2>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-clinical-400 italic py-6 text-center">No activity yet today</p>
          ) : (
            <div className="space-y-3">
              {recentActivity.map((a: any, i: number) => (
                <div key={i} className="flex items-start gap-2.5">
                  <ActivityIcon type={a.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-clinical-800 leading-snug truncate">{a.message}</p>
                    {a.actor && (
                      <p className="text-xs text-clinical-400 mt-0.5">by {a.actor}</p>
                    )}
                  </div>
                  <span className="text-xs text-clinical-400 shrink-0 mt-0.5">{fmtTime(a.time)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
""".strip()

# ─────────────────────────────────────────────────────────────────────────────
# WRITE ALL FILES + patch DashboardPage
# ─────────────────────────────────────────────────────────────────────────────
for rel, content in files.items():
    dest = pathlib.Path(BASE) / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(content)
    print(f"WRITTEN → {rel}")

# ── Patch DashboardPage.tsx ───────────────────────────────────────────────
page_path = pathlib.Path(BASE) / "frontend/src/pages/DashboardPage.tsx"
if page_path.exists():
    src = page_path.read_text()
    changed = False

    # Add import if missing
    if 'AdminDashboardSection' not in src:
        src = "import { AdminDashboardSection } from '../modules/dashboard/AdminDashboardSection';\n" + src
        changed = True
        print("OK — AdminDashboardSection import added to DashboardPage.tsx")
    else:
        print("OK — AdminDashboardSection already imported")

    # Make sure <AdminDashboardSection /> appears in admin branch
    if '<AdminDashboardSection' not in src:
        print("WARN — could not auto-insert <AdminDashboardSection /> — add it manually in the scope==='admin' branch")
    else:
        print("OK — AdminDashboardSection already rendered")

    if changed:
        page_path.write_text(src)
else:
    print(f"WARN — DashboardPage.tsx not found at {page_path}")

print("\n✅ ALL DONE. Steps:")
print("  1. Restart backend:  Ctrl-C → npm run start:dev  (in backend folder)")
print("  2. Refresh browser")
