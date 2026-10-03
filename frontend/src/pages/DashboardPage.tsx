import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Users, Calendar, Clock, FlaskConical, Pill, UserCheck, Activity, Loader2,
  ArrowRight, TrendingUp, DollarSign, AlertTriangle, Package,
  CheckCircle, XCircle,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { dashboardApi, visitsApi } from '../services/api';
import { useAuthStore } from '../stores/auth.store';
import { AdminDashboardSection, type AdminDashboardStats } from '../modules/dashboard/AdminDashboardSection';
import logoImg from '../assets/somacare-logo.png';
import doctorImg from '../assets/dashboard-doctor.jpeg';

interface DoctorDashboard {
  scope: 'doctor';
  totalPatients: number; todaysVisits: number; currentlyWithYou: number;
  todaysAppointments: number;
  labRequests: { pending: number; total: number };
  prescriptions: { dispensed: number; total: number };
}
interface FacilityDashboard {
  scope: 'facility';
  totalPatients: number; todaysVisits: number; waitingPatients: number;
  todaysAppointments: number; doctorsAvailable: number;
  labRequests: { pending: number; total: number };
  prescriptions: { dispensed: number; total: number };
  weeklyVisits: { day: string; visits: number }[];
  patientsByDepartment: { name: string; patients: number }[];
}
interface NurseDashboard {
  scope: 'nurse';
  todaysVisits: number; waitingForTriage: number; inTriage: number;
  emergencyCases: number; todaysAppointments: number;
}
interface ReceptionistDashboard {
  scope: 'receptionist';
  todaysAppointments: number; checkedInToday: number; newPatientsToday: number; waitingPatients: number;
  upcomingAppointments: { id: string; time: string; doctorName: string; status: string; type: string }[];
}
interface PharmacistDashboard {
  scope: 'pharmacist';
  totalMedicines: number; lowStockCount: number; pendingCount: number; dispensedToday: number;
  lowStockItems: { id: string; name: string; stock: number; reorderLevel: number }[];
}
interface AccountantDashboard {
  scope: 'accountant';
  totalInvoices: number; paidCount: number; unpaidCount: number; partialCount: number;
  revenueToday: number; outstandingBalance: number;
  revenueByDay: { date: string; amount: number }[];
}

interface LaboratoryDashboard {
  scope: 'laboratory';
  totalOrders: number;
  pendingOrders: number;
  inProgressOrders: number;
  completedToday: number;
  recentOrders: { id: string; patientName: string; testName: string; status: string; createdAt: string }[];
}

type DashboardData =
  | DoctorDashboard | FacilityDashboard | AdminDashboardStats
  | NurseDashboard | ReceptionistDashboard | PharmacistDashboard | AccountantDashboard;

interface QueuePatient {
  id: string; visitNumber?: string; status: string; chiefComplaint?: string;
  patient?: { firstName?: string; lastName?: string; gender?: string; dateOfBirth?: string };
}

const STATUS_STYLES: Record<string, string> = {
  waiting: 'bg-amber-100 text-amber-700',
  in_triage: 'bg-blue-100 text-blue-700',
  with_doctor: 'bg-primary-100 text-primary-700',
  ready_discharge: 'bg-green-100 text-green-700',
  completed: 'bg-clinical-100 text-clinical-600',
  cancelled: 'bg-red-100 text-red-600',
};

function statusLabel(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function KpiCard({ title, value, subtitle, icon: Icon, color, onClick }: any) {
  return (
    <div onClick={onClick} className={`bg-white rounded-xl border border-clinical-200 p-5 flex items-start gap-4 transition-shadow ${onClick ? 'cursor-pointer hover:shadow-md hover:border-primary-300' : 'hover:shadow-sm'}`}>
      <div className={`p-3 rounded-xl ${color}`}><Icon size={22} className="text-white" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-clinical-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-clinical-900 mt-0.5">{value}</p>
        {subtitle && <p className="text-xs text-clinical-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function DonutStat({ title, doneLabel, done, pendingLabel, pending, doneColor, pendingColor }: any) {
  const total = done + pending;
  const data = total > 0 ? [{ name: doneLabel, value: done }, { name: pendingLabel, value: pending }] : [{ name: 'No data', value: 1 }];
  const colors = total > 0 ? [doneColor, pendingColor] : ['#e2e8f0'];
  return (
    <div className="bg-white rounded-xl border border-clinical-200 p-5">
      <h3 className="text-sm font-semibold text-clinical-800 mb-2">{title}</h3>
      <div className="flex items-center gap-4">
        <ResponsiveContainer width={120} height={120}>
          <PieChart><Pie data={data} dataKey="value" innerRadius={38} outerRadius={56} paddingAngle={total > 0 ? 3 : 0}>{data.map((_, i) => <Cell key={i} fill={colors[i]} />)}</Pie></PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: doneColor }} /><span className="text-clinical-600">{doneLabel}</span><span className="font-bold text-clinical-900 ml-auto">{done}</span></div>
          <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: pendingColor }} /><span className="text-clinical-600">{pendingLabel}</span><span className="font-bold text-clinical-900 ml-auto">{pending}</span></div>
          <div className="flex items-center gap-2 pt-1 border-t border-clinical-100 mt-2"><span className="text-clinical-400 text-xs">Total</span><span className="font-semibold text-clinical-700 text-xs ml-auto">{total}</span></div>
        </div>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await dashboardApi.getStats();
      return res.data as DashboardData;
    },
  });

  const isDoctor = data?.scope === 'doctor';

  const { data: queue = [] } = useQuery({
    queryKey: ['visits', 'queue'],
    queryFn: async () => {
      const res = await visitsApi.getQueue();
      const raw = res.data;
      const list = Array.isArray(raw) ? raw : (raw?.data ?? raw?.items ?? []);
      return (Array.isArray(list) ? list : []) as QueuePatient[];
    },
    enabled: isDoctor,
  });

  const today = new Date();

  return (
    <div className="space-y-6">
      {/* SOMCARE hero banner — shown on every dashboard, not just doctors */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-950 via-primary-900 to-primary-800">
        <div className="relative flex flex-col sm:flex-row sm:items-stretch">
          {/* Logo + wordmark */}
          <div className="flex items-center gap-3 px-6 py-5 sm:border-r border-white/15 flex-shrink-0">
            <img src={logoImg} alt="Somcare" className="w-12 h-12 sm:w-14 sm:h-14 object-contain flex-shrink-0" />
            <div>
              <p className="font-extrabold text-lg sm:text-xl leading-tight tracking-wide whitespace-nowrap">
                <span className="text-white">SOM</span><span className="text-red-400">CARE</span>
              </p>
              <p className="text-[10px] sm:text-[11px] text-white/60 tracking-wide whitespace-nowrap">Better Health &bull; Brighter Future</p>
            </div>
          </div>

          {/* Welcome message */}
          <div className="flex-1 flex items-center px-6 py-5 min-w-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white">
                Welcome, {isDoctor ? `Dr. ${user?.lastName ?? user?.fullName}` : (user?.fullName ?? user?.firstName)}
              </h1>
              <p className="text-white/80 text-sm mt-1">You are logged in to SOMCARE. Let's make a healthier tomorrow together.</p>
            </div>
          </div>

          {/* Doctor photo */}
          <div className="hidden md:block relative w-52 lg:w-64 flex-shrink-0 overflow-hidden">
            <img src={doctorImg} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-900/50 to-transparent" />
          </div>

          {/* Tagline corner */}
          <div className="hidden lg:flex flex-col items-end justify-center px-6 py-5 text-right flex-shrink-0 max-w-[190px]">
            <p className="text-white font-semibold text-sm leading-snug">Advanced care for a healthier community.</p>
          </div>
        </div>
      </div>

      <div className="flex justify-end items-center gap-2 text-clinical-500 text-sm -mt-2">
        <Calendar size={16} />
        {today.toLocaleDateString('en-US', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-clinical-500 text-sm py-8 justify-center">
          <Loader2 size={18} className="animate-spin" /> Loading dashboard…
        </div>
      )}
      {isError && (
        <div className="bg-white rounded-xl border border-red-200 p-5 text-sm text-red-600">
          Couldn't load dashboard data. Try refreshing the page.
        </div>
      )}

      {/* ── Doctor ─────────────────────────────────────────────────────── */}
      {data?.scope === 'doctor' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Patients"      value={data.totalPatients}          subtitle="Assigned to you"       icon={Users}       color="bg-primary-600" onClick={() => navigate('/patients')} />
            <KpiCard title="Today's Visits"      value={data.todaysVisits}           subtitle="Checked in today"      icon={Activity}    color="bg-blue-500"    onClick={() => navigate('/patients/visits')} />
            <KpiCard title="Currently With You"  value={data.currentlyWithYou}       subtitle="In consultation now"   icon={Clock}       color="bg-amber-500"   onClick={() => navigate('/queue')} />
            <KpiCard title="Appointments"        value={data.todaysAppointments}     subtitle="Scheduled today"       icon={Calendar}    color="bg-purple-500"  onClick={() => navigate('/appointments')} />
            <KpiCard title="Lab Requests"        value={data.labRequests.total}      subtitle={`Pending: ${data.labRequests.pending}`}    icon={FlaskConical} color="bg-indigo-500" onClick={() => navigate('/laboratory')} />
            <KpiCard title="Prescriptions"       value={data.prescriptions.total}    subtitle={`Dispensed: ${data.prescriptions.dispensed}`} icon={Pill}      color="bg-rose-500"   onClick={() => navigate('/pharmacy/prescriptions')} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DonutStat title="Lab Requests"   doneLabel="Completed" done={Math.max(data.labRequests.total - data.labRequests.pending, 0)} pendingLabel="Pending"  pending={data.labRequests.pending}                                      doneColor="#16a34a" pendingColor="#f59e0b" />
            <DonutStat title="Prescriptions"  doneLabel="Dispensed" done={data.prescriptions.dispensed}                                   pendingLabel="Pending"  pending={Math.max(data.prescriptions.total - data.prescriptions.dispensed, 0)} doneColor="#c11414" pendingColor="#e2e8f0" />
          </div>
          <div className="bg-white rounded-xl border border-clinical-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-clinical-800">My Patients — Today</h3>
              <button onClick={() => navigate('/queue/current')} className="text-xs font-semibold text-primary-600 flex items-center gap-1 hover:underline">View all <ArrowRight size={12} /></button>
            </div>
            {queue.length === 0
              ? <p className="text-sm text-clinical-400 text-center py-8">No patients in your queue right now.</p>
              : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">#</th>
                      <th className="px-5 py-2 font-semibold">Patient</th>
                      <th className="px-5 py-2 font-semibold">Visit Reason</th>
                      <th className="px-5 py-2 font-semibold">Status</th>
                      <th className="px-5 py-2 font-semibold text-right">Action</th>
                    </tr></thead>
                    <tbody>
                      {queue.slice(0, 8).map((v, i) => {
                        const name = `${v.patient?.firstName ?? ''} ${v.patient?.lastName ?? ''}`.trim() || 'Unknown patient';
                        const initials = `${v.patient?.firstName?.[0] ?? ''}${v.patient?.lastName?.[0] ?? ''}`.toUpperCase();
                        return (
                          <tr key={v.id} className="border-t border-clinical-50">
                            <td className="px-5 py-3 text-clinical-400">{i + 1}</td>
                            <td className="px-5 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{initials || '?'}</div><span className="font-medium text-clinical-900">{name}</span></div></td>
                            <td className="px-5 py-3 text-clinical-500">{v.chiefComplaint || '—'}</td>
                            <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[v.status] ?? 'bg-clinical-100 text-clinical-600'}`}>{statusLabel(v.status)}</span></td>
                            <td className="px-5 py-3 text-right"><button onClick={() => navigate(`/clinical/consultation/${v.id}`)} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700">Open</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}

      {/* ── Nurse ──────────────────────────────────────────────────────── */}
      {data?.scope === 'nurse' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Today's Visits"      value={data.todaysVisits}      subtitle="Checked in today"  icon={Activity}  color="bg-blue-500"   onClick={() => navigate('/patients/visits')} />
          <KpiCard title="Waiting for Triage"  value={data.waitingForTriage}  subtitle="In queue"          icon={Clock}     color="bg-amber-500"  onClick={() => navigate('/queue')} />
          <KpiCard title="In Triage"           value={data.inTriage}          subtitle="Being assessed"    icon={UserCheck} color="bg-teal-500"   onClick={() => navigate('/queue')} />
          <KpiCard title="Emergency Cases"     value={data.emergencyCases}    subtitle="Today"             icon={Activity}  color="bg-red-500"    onClick={() => navigate('/queue')} />
        </div>
      )}

      {/* ── Receptionist ───────────────────────────────────────────────── */}
      {data?.scope === 'receptionist' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Today's Appointments" value={data.todaysAppointments} icon={Calendar}  color="bg-purple-500"  onClick={() => navigate('/appointments')} />
            <KpiCard title="Checked In Today"     value={data.checkedInToday}     icon={Activity}  color="bg-blue-500"    onClick={() => navigate('/patients/visits')} />
            <KpiCard title="New Patients Today"   value={data.newPatientsToday}   icon={Users}     color="bg-primary-600" onClick={() => navigate('/patients')} />
            <KpiCard title="Waiting Patients"     value={data.waitingPatients}    subtitle="Current queue" icon={Clock} color="bg-amber-500" onClick={() => navigate('/queue')} />
          </div>
          <div className="bg-white rounded-xl border border-clinical-200 p-5">
            <h3 className="text-sm font-semibold text-clinical-800 mb-4">Today's Appointments</h3>
            {data.upcomingAppointments.length === 0
              ? <p className="text-sm text-clinical-400 text-center py-8">No appointments scheduled today.</p>
              : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Time</th>
                      <th className="px-5 py-2 font-semibold">Doctor</th>
                      <th className="px-5 py-2 font-semibold">Type</th>
                      <th className="px-5 py-2 font-semibold">Status</th>
                    </tr></thead>
                    <tbody>
                      {data.upcomingAppointments.map((a) => (
                        <tr key={a.id} className="border-t border-clinical-50">
                          <td className="px-5 py-3 text-clinical-900 font-medium">{a.time}</td>
                          <td className="px-5 py-3 text-clinical-600">{a.doctorName}</td>
                          <td className="px-5 py-3 text-clinical-500 capitalize">{a.type}</td>
                          <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[a.status] ?? 'bg-clinical-100 text-clinical-600'}`}>{statusLabel(a.status)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}

      {/* ── Pharmacist ─────────────────────────────────────────────────── */}
      {data?.scope === 'pharmacist' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Medicines"    value={data.totalMedicines}  subtitle="Active inventory"     icon={Package}       color="bg-teal-600"    onClick={() => navigate('/pharmacy')} />
            <KpiCard title="Pending Dispense"   value={data.pendingCount}    subtitle="Awaiting dispensing"  icon={Clock}         color="bg-amber-500"   onClick={() => navigate('/pharmacy/prescriptions')} />
            <KpiCard title="Dispensed Today"    value={data.dispensedToday}  subtitle="Completed today"      icon={CheckCircle}   color="bg-green-600"   onClick={() => navigate('/pharmacy/prescriptions')} />
            <KpiCard title="Low Stock Alerts"   value={data.lowStockCount}   subtitle="Need reordering"      icon={AlertTriangle} color="bg-red-500"     onClick={() => navigate('/pharmacy')} />
          </div>

          <div className="bg-white rounded-xl border border-clinical-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-clinical-800">Low Stock Medicines</h3>
              <button onClick={() => navigate('/pharmacy')} className="text-xs font-semibold text-primary-600 flex items-center gap-1 hover:underline">View all <ArrowRight size={12} /></button>
            </div>
            {data.lowStockItems.length === 0
              ? <p className="text-sm text-clinical-400 text-center py-8">All medicines are adequately stocked.</p>
              : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Medicine</th>
                      <th className="px-5 py-2 font-semibold text-right">In Stock</th>
                      <th className="px-5 py-2 font-semibold text-right">Reorder Level</th>
                      <th className="px-5 py-2 font-semibold text-right">Status</th>
                    </tr></thead>
                    <tbody>
                      {data.lowStockItems.map((m) => (
                        <tr key={m.id} className="border-t border-clinical-50">
                          <td className="px-5 py-3 font-medium text-clinical-900">{m.name}</td>
                          <td className="px-5 py-3 text-right font-bold text-red-600">{m.stock}</td>
                          <td className="px-5 py-3 text-right text-clinical-500">{m.reorderLevel}</td>
                          <td className="px-5 py-3 text-right">
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                              {m.stock === 0 ? 'Out of stock' : 'Low stock'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}

      {/* ── Accountant ─────────────────────────────────────────────────── */}
      {data?.scope === 'accountant' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Revenue Today"       value={`$${fmt(data.revenueToday)}`}       subtitle="Paid invoices"        icon={DollarSign}  color="bg-green-600"   onClick={() => navigate('/billing/invoices')} />
            <KpiCard title="Outstanding Balance" value={`$${fmt(data.outstandingBalance)}`} subtitle="Unpaid invoices"      icon={TrendingUp}  color="bg-red-500"     onClick={() => navigate('/billing/invoices')} />
            <KpiCard title="Unpaid Invoices"     value={data.unpaidCount}                   subtitle="Awaiting payment"     icon={XCircle}     color="bg-amber-500"   onClick={() => navigate('/billing/invoices')} />
            <KpiCard title="Paid Invoices"       value={data.paidCount}                     subtitle={`of ${data.totalInvoices} total`} icon={CheckCircle} color="bg-blue-500" onClick={() => navigate('/billing/invoices')} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-clinical-200 p-5">
              <h3 className="text-sm font-semibold text-clinical-800 mb-4">Revenue — Last 7 Days</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.revenueByDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tickFormatter={(d) => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip formatter={(v: any) => [`$${fmt(v)}`, 'Revenue']} labelFormatter={(d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                  <Bar dataKey="amount" fill="#16a34a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-clinical-200 p-5">
              <h3 className="text-sm font-semibold text-clinical-800 mb-4">Invoice Breakdown</h3>
              <DonutStat
                title=""
                doneLabel="Paid"    done={data.paidCount}
                pendingLabel="Unpaid" pending={data.unpaidCount}
                doneColor="#16a34a" pendingColor="#ef4444"
              />
              {data.partialCount > 0 && (
                <p className="text-xs text-clinical-400 mt-3 text-center">{data.partialCount} partial payment{data.partialCount > 1 ? 's' : ''} not shown above</p>
              )}
            </div>
          </div>
        </>
      )}


      {/* ── Laboratory ────────────────────────────────────────────────── */}
      {data?.scope === 'laboratory' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Orders Today"     value={data.totalOrders}      subtitle="Received today"     icon={FlaskConical} color="bg-indigo-600"  onClick={() => navigate('/laboratory')} />
            <KpiCard title="Pending"          value={data.pendingOrders}    subtitle="Awaiting processing" icon={Clock}        color="bg-amber-500"   onClick={() => navigate('/laboratory')} />
            <KpiCard title="In Progress"      value={data.inProgressOrders} subtitle="Being processed"    icon={Activity}     color="bg-blue-500"    onClick={() => navigate('/laboratory')} />
            <KpiCard title="Completed Today"  value={data.completedToday}   subtitle="Results ready"      icon={CheckCircle}  color="bg-green-600"   onClick={() => navigate('/laboratory')} />
          </div>

          <div className="bg-white rounded-xl border border-clinical-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-clinical-800">Today's Lab Orders</h3>
              <button onClick={() => navigate('/laboratory')} className="text-xs font-semibold text-primary-600 flex items-center gap-1 hover:underline">View all <ArrowRight size={12} /></button>
            </div>
            {data.recentOrders.length === 0
              ? <p className="text-sm text-clinical-400 text-center py-8">No lab orders today.</p>
              : (
                <div className="overflow-x-auto -mx-5">
                  <table className="w-full text-sm">
                    <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                      <th className="px-5 py-2 font-semibold">Patient</th>
                      <th className="px-5 py-2 font-semibold">Test</th>
                      <th className="px-5 py-2 font-semibold">Status</th>
                      <th className="px-5 py-2 font-semibold text-right">Time</th>
                    </tr></thead>
                    <tbody>
                      {data.recentOrders.map((o) => (
                        <tr key={o.id} className="border-t border-clinical-50">
                          <td className="px-5 py-3 font-medium text-clinical-900">{o.patientName}</td>
                          <td className="px-5 py-3 text-clinical-600">{o.testName}</td>
                          <td className="px-5 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${STATUS_STYLES[o.status] ?? 'bg-clinical-100 text-clinical-600'}`}>
                              {statusLabel(o.status)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-clinical-400 text-xs">
                            {new Date(o.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
          </div>
        </>
      )}

      {/* ── Facility ───────────────────────────────────────────────────── */}
      {data?.scope === 'facility' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard title="Total Patients"    value={data.totalPatients}          icon={Users}       color="bg-primary-600" onClick={() => navigate('/patients')} />
            <KpiCard title="Today's Visits"    value={data.todaysVisits}           icon={Activity}    color="bg-blue-500"    onClick={() => navigate('/patients/visits')} />
            <KpiCard title="Waiting Patients"  value={data.waitingPatients}        subtitle="Current queue" icon={Clock}    color="bg-amber-500"  onClick={() => navigate('/queue')} />
            <KpiCard title="Appointments"      value={data.todaysAppointments}     subtitle="Scheduled today" icon={Calendar} color="bg-purple-500" onClick={() => navigate('/appointments')} />
            <KpiCard title="Doctors Available" value={data.doctorsAvailable}       icon={UserCheck}   color="bg-teal-500"   onClick={() => navigate('/staff')} />
            <KpiCard title="Lab Requests"      value={data.labRequests.total}      subtitle={`Pending: ${data.labRequests.pending}`}    icon={FlaskConical} color="bg-indigo-500" onClick={() => navigate('/laboratory')} />
            <KpiCard title="Prescriptions"     value={data.prescriptions.total}    subtitle={`Dispensed: ${data.prescriptions.dispensed}`} icon={Pill}      color="bg-rose-500"   onClick={() => navigate('/pharmacy/prescriptions')} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-clinical-200 p-5">
              <h3 className="text-base font-semibold text-clinical-800 mb-4">Patient Visits — This Week</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.weeklyVisits}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="day" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="visits" stroke="#c11414" strokeWidth={2} dot={{ r: 4 }} /></LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl border border-clinical-200 p-5">
              <h3 className="text-base font-semibold text-clinical-800 mb-4">Patients by Department</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.patientsByDepartment}><CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="patients" fill="#c11414" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      {/* Admin dashboard: shown for 'admin' scope AND executive roles that
          the backend routes to getAdminDashboard() */}
      {(data?.scope === 'admin' || (() => {
        const EXEC = ['administrator','ceo','medical_director','chief_nursing_officer','chief_admin_officer','manager'];
        return EXEC.some(r => user?.roles?.includes(r));
      })()) && !['doctor','nurse','receptionist','pharmacist','accountant','laboratory','facility'].includes(data?.scope ?? '') && (
        <AdminDashboardSection data={data as any} user={user} navigate={navigate} />
      )}
    </div>
  );
}
