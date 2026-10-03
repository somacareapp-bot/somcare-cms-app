import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, Clock, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import { visitsApi } from '../../services/api';

const STATUS_COLORS: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-700',
  in_triage: 'bg-orange-100 text-orange-700',
  in_consultation: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const STATUS_LABELS: Record<string, string> = {
  waiting: 'Waiting',
  in_triage: 'In triage',
  in_consultation: 'In consultation',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function PatientVisitsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ['visits', search, statusFilter, page],
    queryFn: () =>
      visitsApi
        .getAll(statusFilter || undefined)
        .then((r) => r.data),
  });

  // Support both { data: [], total } and flat array responses
  const raw = data?.data ?? data ?? [];
  const visits: any[] = search
    ? raw.filter((v: any) => {
        const name = [v.patient?.firstName, v.patient?.middleName, v.patient?.lastName]
          .filter(Boolean).join(' ').toLowerCase();
        const visitNum = (v.visitNumber ?? '').toLowerCase();
        const patientCode = (v.patient?.patientNumber ?? '').toLowerCase();
        const phone = (v.patient?.phone ?? '').toLowerCase();
        const q = search.toLowerCase();
        return (
          name.includes(q) ||
          visitNum.includes(q) ||
          patientCode.includes(q) ||
          phone.includes(q)
        );
      })
    : raw;
  const totalPages = (data?.totalPages) ?? (Math.ceil(((data?.total ?? visits.length) / limit)) || 1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Patient Visits</h1>
          <p className="text-clinical-500 text-sm mt-1">
            {data?.total ?? visits.length} visits on record
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200">
        {/* Toolbar */}
        <div className="p-4 border-b border-clinical-100 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by patient name, patient code, phone, or visit number..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="text-sm border border-clinical-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-clinical-500 border-b border-clinical-100">
                <th className="px-4 py-3 font-medium">Visit #</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Checked in</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-clinical-400">Loading...</td></tr>
              )}
              {isError && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-red-500">Failed to load visits.</td></tr>
              )}
              {!isLoading && !isError && visits.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Activity size={32} className="mx-auto text-clinical-300 mb-2" />
                    <p className="text-clinical-400">No visits found.</p>
                    <p className="text-clinical-300 text-xs mt-1">Visits are created when patients check in at the queue.</p>
                  </td>
                </tr>
              )}
              {visits.map((v: any) => {
                const name = [v.patient?.firstName, v.patient?.middleName, v.patient?.lastName]
                  .filter(Boolean).join(' ') || '—';
                const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
                const checkedIn = v.checkedInAt
                  ? new Date(v.checkedInAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '—';

                return (
                  <tr
                    key={v.id}
                    className="border-b border-clinical-50 hover:bg-clinical-50 cursor-pointer"
                    onClick={() => navigate(`/clinical/consultation/${v.id}`)}
                  >
                    <td className="px-4 py-3 font-medium text-clinical-700">{v.visitNumber ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center font-semibold flex-shrink-0">
                          {initials}
                        </div>
                        <span className="text-clinical-800 font-medium">{name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-clinical-600">
                        <Clock size={12} />
                        {checkedIn}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {STATUS_LABELS[v.status] ?? v.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-clinical-600">{[v.doctor?.firstName, v.doctor?.lastName].filter(Boolean).join(' ') || '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/clinical/consultation/${v.id}`); }}
                        className="p-1.5 rounded-lg hover:bg-clinical-100 text-clinical-400"
                        title="Open consultation"
                      >
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-clinical-100 text-sm text-clinical-500">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-clinical-200 disabled:opacity-40"><ChevronLeft size={16} /></button>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-clinical-200 disabled:opacity-40"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
