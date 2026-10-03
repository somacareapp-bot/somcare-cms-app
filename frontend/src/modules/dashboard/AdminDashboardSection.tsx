import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Stethoscope, UserCog,
  Clock, CheckCircle2, AlertCircle, FlaskConical,
  TrendingUp, Bell, Activity, DollarSign, XCircle, Hourglass,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';
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
          departmentPerformance, alerts, recentActivity,
          revenueToday, outstandingBalance, revenueByDay,
          totalInvoices, paidCount, unpaidCount, pendingApprovalsCount } = data;
  const fmt = (n: number) => (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
        <h1 className="text-2xl font-bold tracking-tight text-clinical-900">DASHBOARD</h1>
        <p className="text-sm text-clinical-500 mt-0.5">
          Welcome back &nbsp;·&nbsp;{' '}
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


      {/* Row: Accounting */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-clinical-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={15} className="text-clinical-400" />
            <h2 className="text-xs font-bold text-clinical-800 uppercase tracking-wide">Revenue — Last 7 Days</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${fmt(v)}`, 'Revenue']} labelFormatter={(d) => new Date(d).toLocaleDateString()} />
              <Bar dataKey="amount" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => navigate('/billing/invoices')}
            className="bg-white rounded-xl border border-clinical-100 p-4 flex flex-col items-start gap-1 hover:shadow-md hover:border-clinical-200 transition-all text-left">
            <div className="bg-green-600 text-white rounded-full w-9 h-9 flex items-center justify-center mb-1"><DollarSign size={16} /></div>
            <p className="text-xs font-semibold text-clinical-500 uppercase tracking-wide">Revenue Today</p>
            <p className="text-xl font-bold text-clinical-900">${fmt(revenueToday)}</p>
          </button>
          <button onClick={() => navigate('/billing/invoices')}
            className="bg-white rounded-xl border border-clinical-100 p-4 flex flex-col items-start gap-1 hover:shadow-md hover:border-clinical-200 transition-all text-left">
            <div className="bg-red-500 text-white rounded-full w-9 h-9 flex items-center justify-center mb-1"><TrendingUp size={16} /></div>
            <p className="text-xs font-semibold text-clinical-500 uppercase tracking-wide">Outstanding</p>
            <p className="text-xl font-bold text-clinical-900">${fmt(outstandingBalance)}</p>
          </button>
          <button onClick={() => navigate('/billing/invoices')}
            className="bg-white rounded-xl border border-clinical-100 p-4 flex flex-col items-start gap-1 hover:shadow-md hover:border-clinical-200 transition-all text-left">
            <div className="bg-amber-500 text-white rounded-full w-9 h-9 flex items-center justify-center mb-1"><XCircle size={16} /></div>
            <p className="text-xs font-semibold text-clinical-500 uppercase tracking-wide">Unpaid Invoices</p>
            <p className="text-xl font-bold text-clinical-900">{unpaidCount}</p>
          </button>
          <button onClick={() => navigate('/billing/expenses')}
            className="bg-white rounded-xl border border-clinical-100 p-4 flex flex-col items-start gap-1 hover:shadow-md hover:border-clinical-200 transition-all text-left">
            <div className="bg-orange-500 text-white rounded-full w-9 h-9 flex items-center justify-center mb-1"><Hourglass size={16} /></div>
            <p className="text-xs font-semibold text-clinical-500 uppercase tracking-wide">Pending Approvals</p>
            <p className="text-xl font-bold text-clinical-900">{pendingApprovalsCount ?? 0}</p>
          </button>
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