import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, Plus, RefreshCw, Search, CheckCircle, XCircle } from 'lucide-react';
import { appointmentsApi, usersApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

type Tab = 'Day' | 'Week' | 'Month' | 'List';

const STATUS_COLORS: Record<string, string> = {
  scheduled: 'bg-clinical-100 text-clinical-600',
  confirmed: 'bg-blue-100 text-blue-700',
  waiting: 'bg-yellow-100 text-yellow-700',
  in_triage: 'bg-orange-100 text-orange-700',
  with_doctor: 'bg-purple-100 text-purple-700',
  ready_discharge: 'bg-teal-100 text-teal-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-red-50 text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  waiting: 'Waiting',
  in_triage: 'In triage',
  with_doctor: 'With doctor',
  ready_discharge: 'Ready for discharge',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No show',
};

function toISO(d: Date) {
  return d.toISOString().split('T')[0];
}

function startOfWeek(d: Date) {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - copy.getDay());
  return copy;
}

function endOfWeek(d: Date) {
  const s = startOfWeek(d);
  s.setDate(s.getDate() + 6);
  return s;
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function AppointmentsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const hasRole = useAuthStore((s) => s.hasRole);
  const canReceptionist = hasRole('receptionist') || hasRole('administrator');

  const initialTab: Tab =
    location.pathname.endsWith('/upcoming') ? 'List' :
    location.pathname.endsWith('/calendar') ? 'Month' : 'Day';

  const [tab, setTab] = useState<Tab>(initialTab);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');

  const today = new Date();

  const dateParams = useMemo(() => {
    if (tab === 'Day') return { date: toISO(today) };
    if (tab === 'Week') return { dateFrom: toISO(startOfWeek(today)), dateTo: toISO(endOfWeek(today)) };
    if (tab === 'Month') return { dateFrom: toISO(startOfMonth(today)), dateTo: toISO(endOfMonth(today)) };
    return { dateFrom: toISO(today) }; // List = upcoming, no end bound
  }, [tab]);

  const pageSize = tab === 'List' ? 10 : 500;

  const queryParams = {
    page: tab === 'List' ? page : 1,
    limit: pageSize,
    ...dateParams,
    ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    ...(doctorFilter !== 'all' ? { doctorId: doctorFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['appointments', queryParams],
    queryFn: () => appointmentsApi.getAll(queryParams).then((r) => r.data),
    refetchInterval: 30000,
  });

  const { data: doctors } = useQuery({
    queryKey: ['users', 'doctors'],
    queryFn: () => usersApi.getDoctors().then((res) => res.data),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => appointmentsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['appointments'] }),
  });

  const rows: any[] = data?.data ?? [];
  const totalPages: number = data?.totalPages ?? 1;

  function switchTab(t: Tab) {
    setTab(t);
    setPage(1);
  }

  const countLabel =
    tab === 'Day' ? `${data?.total ?? 0} appointment${data?.total === 1 ? '' : 's'} today` :
    tab === 'Week' ? `${data?.total ?? 0} appointment${data?.total === 1 ? '' : 's'} this week` :
    tab === 'Month' ? `${data?.total ?? 0} appointment${data?.total === 1 ? '' : 's'} this month` :
    `${data?.total ?? 0} appointment${data?.total === 1 ? '' : 's'} scheduled ahead`;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">
            {tab === 'List' ? 'Upcoming Appointments' : 'Appointments'}
          </h1>
          <p className="text-clinical-500 text-sm mt-1">{countLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-clinical-100 p-1 rounded-lg">
            {(['Day', 'Week', 'Month', 'List'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => switchTab(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                  tab === t ? 'bg-white text-clinical-900 shadow-sm' : 'text-clinical-500 hover:text-clinical-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="p-2.5 rounded-lg border border-clinical-200 hover:bg-clinical-50 text-clinical-500"
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            onClick={() => navigate('/appointments/new')}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} /> New Appointment
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-clinical-100 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search patient, doctor…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-clinical-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={doctorFilter}
            onChange={(e) => { setDoctorFilter(e.target.value); setPage(1); }}
            className="border border-clinical-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-500"
          >
            <option value="all">All doctors</option>
            {(doctors ?? []).map((d: any) => (
              <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="text-center text-clinical-400 py-16">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-clinical-400 text-sm">No appointments in this view.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinical-100 bg-clinical-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Doctor</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Department</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Fee</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-50">
              {rows.map((a: any) => {
                const name = [a.patient?.firstName, a.patient?.middleName, a.patient?.lastName]
                  .filter(Boolean).join(' ') || '—';
                const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                const time = a.appointmentTime
                  ? new Date(`1970-01-01T${a.appointmentTime}`).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                  : '—';
                const dateLabel = a.appointmentDate
                  ? new Date(a.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                  : '—';
                const doctorName = a.doctor ? `Dr. ${a.doctor.firstName} ${a.doctor.lastName}` : '—';

                return (
                  <tr key={a.id} className="hover:bg-clinical-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-clinical-900 font-medium">{dateLabel}</p>
                      <p className="text-xs text-clinical-400">{time}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="font-semibold text-clinical-900">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-clinical-600">{doctorName}</td>
                    <td className="px-4 py-3 text-clinical-600">{a.department ?? '—'}</td>
                    <td className="px-4 py-3 text-clinical-600 capitalize">{a.type ?? '—'}</td>
                    <td className="px-4 py-3 text-clinical-900 font-medium">
                      {a.fee ? `$${Number(a.fee).toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {/* Once checked in, the appointment record itself stays 'waiting'
                          forever by design — the real status lives on the Visit that
                          check-in created. Show that instead so this list doesn't look stuck. */}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${STATUS_COLORS[a.visitStatus ?? a.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[a.visitStatus ?? a.status] ?? (a.visitStatus ?? a.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        {a.status === 'scheduled' && canReceptionist && (
                          <button
                            onClick={() => statusMutation.mutate({ id: a.id, status: 'confirmed' })}
                            disabled={statusMutation.isPending}
                            title="Confirm"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-clinical-200 text-blue-500 hover:bg-blue-50 disabled:opacity-40"
                          >
                            <CheckCircle size={14} />
                          </button>
                        )}
                        {!['cancelled', 'completed'].includes(a.status) && canReceptionist && (
                          <button
                            onClick={() => statusMutation.mutate({ id: a.id, status: 'cancelled' })}
                            disabled={statusMutation.isPending}
                            title="Cancel"
                            className="w-8 h-8 flex items-center justify-center rounded-lg border border-clinical-200 text-red-400 hover:bg-red-50 disabled:opacity-40"
                          >
                            <XCircle size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/appointments/${a.id}`)}
                          title="View"
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-clinical-200 text-clinical-400 hover:text-clinical-700 hover:border-clinical-300"
                        >
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'List' && rows.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-clinical-100 text-sm text-clinical-500">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-clinical-200 disabled:opacity-30"
              >
                ‹
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-clinical-200 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
