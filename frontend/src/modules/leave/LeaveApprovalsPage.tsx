import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leaveApi, LeaveRequest } from './leaveApi';
import {
  PageHeader, Modal, Field, ErrorBanner, EmptyState, Spinner, StatusBadge, TypeDot,
  inputCls, btnPrimary, btnGhost, cardCls, fmtRange, fmtDays, fmtDate, errMsg, busy,
} from './leaveShared';

export function LeaveApprovalsPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<'pending' | 'decided'>('pending');
  const [deciding, setDeciding] = useState<{ req: LeaveRequest; decision: 'approve' | 'reject' } | null>(null);

  const me = useQuery({ queryKey: ['leave', 'me'], queryFn: leaveApi.me });
  const list = useQuery({
    queryKey: ['leave', 'approvals', view],
    queryFn: () => leaveApi.approvals(view),
    refetchInterval: view === 'pending' ? 30000 : false,
  });
  const rows = list.data ?? [];

  return (
    <div>
      <PageHeader
        title="Leave Approvals"
        subtitle="Requests from your team, routed through the org chart."
      />

      <div className="mb-4 inline-flex rounded-lg border border-gray-200 bg-white p-0.5 text-sm">
        {(['pending', 'decided'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`rounded-md px-3 py-1.5 font-medium ${view === v ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
          >
            {v === 'pending' ? 'Awaiting my review' : 'History'}
          </button>
        ))}
      </div>

      <div className={`${cardCls} overflow-x-auto`}>
        {list.isLoading ? (
          <Spinner />
        ) : rows.length === 0 ? (
          <EmptyState
            text={
              view === 'pending'
                ? me.data?.isApprover
                  ? 'Nothing waiting for your review.'
                  : 'You are not set as an approver for anyone. Approvers are set on the Org chart and Departments pages.'
                : 'No decisions yet.'
            }
          />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Staff</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Days</th>
                <th className="px-4 py-3">{view === 'pending' ? 'Submitted' : 'Decision'}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="px-4 py-3 font-medium text-gray-900">{r.userName}</td>
                  <td className="px-4 py-3"><TypeDot color={r.leaveType?.color} name={r.leaveType?.name} /></td>
                  <td className="px-4 py-3 text-gray-700">
                    {fmtRange(r.startDate, r.endDate)}
                    {r.reason && <div className="mt-0.5 max-w-xs text-xs text-gray-500">{r.reason}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{fmtDays(r.days)}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {view === 'pending' ? (
                      fmtDate(r.createdAt)
                    ) : (
                      <>
                        <StatusBadge status={r.status} />
                        <div className="mt-1 text-xs text-gray-500">by {r.decidedByName} · {fmtDate(r.decidedAt)}</div>
                        {r.decisionNote && <div className="text-xs text-gray-500">“{r.decisionNote}”</div>}
                      </>
                    )}
                  </td>
                  <td className="space-x-2 whitespace-nowrap px-4 py-3 text-right">
                    {view === 'pending' && (
                      <>
                        <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700" onClick={() => setDeciding({ req: r, decision: 'approve' })}>
                          Approve
                        </button>
                        <button className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700" onClick={() => setDeciding({ req: r, decision: 'reject' })}>
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {deciding && (
        <DecisionModal
          req={deciding.req}
          decision={deciding.decision}
          onClose={() => setDeciding(null)}
          onDone={() => { setDeciding(null); qc.invalidateQueries({ queryKey: ['leave'] }); }}
        />
      )}
    </div>
  );
}

function DecisionModal({ req, decision, onClose, onDone }: { req: LeaveRequest; decision: 'approve' | 'reject'; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => leaveApi.decide(req.id, { decision, note: note.trim() || undefined }),
    onSuccess: onDone,
    onError: (e) => setError(errMsg(e)),
  });
  const reject = decision === 'reject';

  return (
    <Modal title={reject ? 'Reject leave request' : 'Approve leave request'} onClose={onClose}>
      <div className="space-y-4">
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
          <strong>{req.userName}</strong> · {req.leaveType?.name} · {fmtRange(req.startDate, req.endDate)} ({fmtDays(req.days)} day(s))
        </div>
        <Field label={reject ? 'Reason for rejecting (required)' : 'Note (optional)'}>
          <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorBanner message={error} />
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Close</button>
          <button
            className={btnPrimary}
            disabled={(reject && !note.trim()) || busy(save)}
            onClick={() => { setError(null); save.mutate(); }}
          >
            {busy(save) ? 'Saving…' : reject ? 'Reject request' : 'Approve request'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
