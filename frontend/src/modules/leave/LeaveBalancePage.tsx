import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { leaveApi, BalanceRow } from './leaveApi';
import {
  PageHeader, Modal, Field, ErrorBanner, EmptyState, Spinner, TypeDot,
  inputCls, btnPrimary, btnGhost, cardCls, fmtDays, errMsg, busy,
} from './leaveShared';

export function LeaveBalancePage() {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [search, setSearch] = useState('');
  const [adjusting, setAdjusting] = useState<BalanceRow | null>(null);

  const me = useQuery({ queryKey: ['leave', 'me'], queryFn: leaveApi.me });
  const data = useQuery({ queryKey: ['leave', 'balances', scope, year], queryFn: () => leaveApi.balances(scope, year) });

  const rows = data.data?.rows ?? [];
  const filtered = useMemo(
    () => rows.filter((r) => !search || r.userName.toLowerCase().includes(search.toLowerCase())),
    [rows, search],
  );

  return (
    <div>
      <PageHeader
        title="Leave Balance"
        subtitle="Days are earned monthly, then reduced by approved and pending requests."
        actions={
          <select className={`${inputCls} w-28`} value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        }
      />

      {me.data?.isAdmin && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
            {(['mine', 'all'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`rounded-md px-3 py-1.5 font-medium ${scope === s ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {s === 'mine' ? 'My balance' : 'All staff'}
              </button>
            ))}
          </div>
          {scope === 'all' && (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-2.5 text-gray-400" />
              <input className={`${inputCls} w-64 pl-9`} placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
        </div>
      )}

      <div className={`${cardCls} overflow-x-auto`}>
        {data.isLoading ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <EmptyState text="No balances to show." />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                {scope === 'all' && <th className="px-4 py-3">Staff</th>}
                <th className="px-4 py-3">Leave type</th>
                <th className="px-4 py-3 text-right">Accrual / month</th>
                <th className="px-4 py-3 text-right">Earned</th>
                <th className="px-4 py-3 text-right">Adjusted</th>
                <th className="px-4 py-3 text-right">Used</th>
                <th className="px-4 py-3 text-right">Pending</th>
                <th className="px-4 py-3 text-right">Available</th>
                {me.data?.isAdmin && scope === 'all' && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((r) => (
                <tr key={`${r.userId}-${r.leaveTypeId}`}>
                  {scope === 'all' && <td className="px-4 py-3 font-medium text-gray-900">{r.userName}</td>}
                  <td className="px-4 py-3"><TypeDot color={r.color} name={r.leaveTypeName} /></td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.isUnlimited ? '—' : fmtDays(r.accrualPerMonth)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.isUnlimited ? '—' : fmtDays(r.accrued)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{r.isUnlimited ? '—' : fmtDays(r.adjustment)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtDays(r.used)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{fmtDays(r.pending)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{r.isUnlimited ? 'No limit' : fmtDays(r.available)}</td>
                  {me.data?.isAdmin && scope === 'all' && (
                    <td className="px-4 py-3 text-right">
                      {!r.isUnlimited && (
                        <button className="text-sm font-medium text-primary-600 hover:underline" onClick={() => setAdjusting(r)}>
                          Adjust
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {adjusting && <AdjustModal row={adjusting} year={year} onClose={() => setAdjusting(null)} />}
    </div>
  );
}

function AdjustModal({ row, year, onClose }: { row: BalanceRow; year: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [days, setDays] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => leaveApi.adjust({ userId: row.userId, leaveTypeId: row.leaveTypeId, year, days: Number(days), note: note.trim() || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['leave'] }); onClose(); },
    onError: (e) => setError(errMsg(e)),
  });

  const n = Number(days);
  return (
    <Modal title={`Adjust balance — ${row.userName}`} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          {row.leaveTypeName}, {year}: currently <strong>{fmtDays(row.available)}</strong> days available.
        </div>
        <Field label="Days to add (use a negative number to remove)">
          <input type="number" step="0.5" className={inputCls} value={days} onChange={(e) => setDays(e.target.value)} placeholder="e.g. 5 or -2" />
        </Field>
        <Field label="Reason">
          <input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Carried over from last year" />
        </Field>
        <ErrorBanner message={error} />
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Close</button>
          <button className={btnPrimary} disabled={!days || !Number.isFinite(n) || n === 0 || busy(save)} onClick={() => { setError(null); save.mutate(); }}>
            {busy(save) ? 'Saving…' : 'Save adjustment'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
