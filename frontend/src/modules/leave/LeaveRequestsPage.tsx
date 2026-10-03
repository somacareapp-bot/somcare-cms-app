import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { leaveApi, LeaveRequest } from './leaveApi';
import {
  PageHeader, Modal, Field, ErrorBanner, EmptyState, Spinner, StatusBadge, TypeDot,
  inputCls, btnPrimary, btnGhost, cardCls, fmtRange, fmtDays, fmtDate, errMsg, busy, countDays, todayIso,
} from './leaveShared';

export function LeaveRequestsPage() {
  const qc = useQueryClient();
  const year = new Date().getFullYear();
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const me = useQuery({ queryKey: ['leave', 'me'], queryFn: leaveApi.me });
  const requests = useQuery({ queryKey: ['leave', 'requests', scope], queryFn: () => leaveApi.requests(scope) });
  const balances = useQuery({ queryKey: ['leave', 'balances', 'mine', year], queryFn: () => leaveApi.balances('mine', year) });

  const refresh = () => qc.invalidateQueries({ queryKey: ['leave'] });
  const cancel = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id),
    onSuccess: () => { setActionError(null); refresh(); },
    onError: (e) => setActionError(errMsg(e)),
  });

  const list: LeaveRequest[] = requests.data ?? [];
  const canCancel = (r: LeaveRequest) =>
    (r.status === 'pending' || (r.status === 'approved' && r.startDate >= todayIso())) &&
    (r.userId === me.data?.userId || !!me.data?.isAdmin);

  return (
    <div>
      <PageHeader
        title="Leave Requests"
        subtitle="Request time off and track the status of your requests."
        actions={
          <button className={btnPrimary} onClick={() => setShowForm(true)}>
            <Plus size={16} /> New request
          </button>
        }
      />

      {/* Balance summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(balances.data?.rows ?? []).map((b) => (
          <div key={b.leaveTypeId} className={`${cardCls} p-4`}>
            <div className="text-sm text-gray-500"><TypeDot color={b.color} name={b.leaveTypeName} /></div>
            <div className="mt-2 text-2xl font-bold text-gray-900">
              {b.isUnlimited ? 'No limit' : fmtDays(b.available)}
              {!b.isUnlimited && <span className="ml-1 text-sm font-normal text-gray-500">days left</span>}
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {b.isUnlimited
                ? `${fmtDays(b.used)} used this year`
                : `${fmtDays(b.used)} used · ${fmtDays(b.pending)} pending · ${fmtDays(b.accrued + b.adjustment)} earned`}
            </div>
          </div>
        ))}
      </div>

      {me.data?.isAdmin && (
        <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
          {(['mine', 'all'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`rounded-md px-3 py-1.5 font-medium ${scope === s ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {s === 'mine' ? 'My requests' : 'All staff'}
            </button>
          ))}
        </div>
      )}

      <div className="mb-3"><ErrorBanner message={actionError} /></div>

      <div className={`${cardCls} overflow-x-auto`}>
        {requests.isLoading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState text="No leave requests yet." />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {scope === 'all' && <th className="px-4 py-3">Staff</th>}
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((r) => (
                <tr key={r.id} className="align-top">
                  {scope === 'all' && <td className="px-4 py-3 font-medium text-gray-900">{r.userName}</td>}
                  <td className="px-4 py-3"><TypeDot color={r.leaveType?.color} name={r.leaveType?.name} /></td>
                  <td className="px-4 py-3 text-gray-700">
                    {fmtRange(r.startDate, r.endDate)}
                    {r.reason && <div className="mt-0.5 max-w-xs truncate text-xs text-gray-500" title={r.reason}>{r.reason}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{fmtDays(r.days)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                    {r.decisionNote && <div className="mt-1 max-w-xs text-xs text-gray-500">“{r.decisionNote}”</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.decidedByName ?? r.approverName ?? <span className="text-gray-400">Administrator</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    {canCancel(r) && (
                      <button
                        className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
                        disabled={busy(cancel)}
                        onClick={() => { if (window.confirm('Cancel this leave request?')) cancel.mutate(r.id); }}
                      >
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && <NewRequestModal onClose={() => setShowForm(false)} onDone={() => { setShowForm(false); refresh(); }} />}
    </div>
  );
}

function NewRequestModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const types = useQuery({ queryKey: ['leave', 'types'], queryFn: () => leaveApi.types() });
  const [leaveTypeId, setLeaveTypeId] = useState('');
  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => leaveApi.createRequest({ leaveTypeId, startDate, endDate, reason: reason.trim() || undefined }),
    onSuccess: onDone,
    onError: (e) => setError(errMsg(e)),
  });

  const days = countDays(startDate, endDate);
  const selected = (types.data ?? []).find((t) => t.id === leaveTypeId);

  return (
    <Modal title="New leave request" onClose={onClose}>
      <div className="space-y-4">
        <Field label="Leave type">
          <select className={inputCls} value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
            <option value="">Select a type…</option>
            {(types.data ?? []).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From">
            <input
              type="date" className={inputCls} value={startDate}
              onChange={(e) => { setStartDate(e.target.value); if (endDate < e.target.value) setEndDate(e.target.value); }}
            />
          </Field>
          <Field label="To">
            <input type="date" className={inputCls} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          Working days requested: <strong>{days}</strong>
          {selected?.maxDaysPerRequest != null && (
            <span className="text-gray-500"> · max {fmtDays(selected.maxDaysPerRequest)} per request</span>
          )}
        </div>
        <Field label="Reason (optional)">
          <textarea className={inputCls} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <ErrorBanner message={error} />
        <div className="flex justify-end gap-2 pt-1">
          <button className={btnGhost} onClick={onClose}>Close</button>
          <button
            className={btnPrimary}
            disabled={!leaveTypeId || !startDate || !endDate || days <= 0 || busy(create)}
            onClick={() => { setError(null); create.mutate(); }}
          >
            {busy(create) ? 'Submitting…' : 'Submit request'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
