import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { leaveApi, LeaveType } from './leaveApi';
import {
  PageHeader, Modal, Field, ErrorBanner, EmptyState, Spinner, TypeDot,
  inputCls, btnPrimary, btnGhost, cardCls, fmtDays, errMsg, busy,
} from './leaveShared';

export function LeaveTypesPage() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<LeaveType | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const me = useQuery({ queryKey: ['leave', 'me'], queryFn: leaveApi.me });
  const types = useQuery({ queryKey: ['leave', 'types', 'all'], queryFn: () => leaveApi.types(true) });
  const isAdmin = !!me.data?.isAdmin;

  const refresh = () => qc.invalidateQueries({ queryKey: ['leave'] });
  const toggle = useMutation({
    mutationFn: (t: LeaveType) => leaveApi.updateType(t.id, { isActive: !t.isActive }),
    onSuccess: () => { setActionError(null); refresh(); },
    onError: (e) => setActionError(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => leaveApi.deleteType(id),
    onSuccess: () => { setActionError(null); refresh(); },
    onError: (e) => setActionError(errMsg(e)),
  });

  const list = types.data ?? [];

  return (
    <div>
      <PageHeader
        title="Leave Types"
        subtitle={isAdmin ? 'Define the kinds of leave staff can request and how they accrue.' : 'The kinds of leave available to staff.'}
        actions={
          isAdmin ? (
            <button className={btnPrimary} onClick={() => setEditing('new')}>
              <Plus size={16} /> Add leave type
            </button>
          ) : undefined
        }
      />
      <div className="mb-3"><ErrorBanner message={actionError} /></div>

      <div className={`${cardCls} overflow-x-auto`}>
        {types.isLoading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState text="No leave types yet." />
        ) : (
          <table className="min-w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Accrual</th>
                <th className="px-4 py-3">Max / year</th>
                <th className="px-4 py-3">Max / request</th>
                <th className="px-4 py-3">Paid</th>
                <th className="px-4 py-3">Status</th>
                {isAdmin && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {list.map((t) => (
                <tr key={t.id} className={t.isActive ? '' : 'opacity-60'}>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <TypeDot color={t.color} name={t.name} />
                    {t.description && <div className="ml-4 text-xs font-normal text-gray-500">{t.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{t.isUnlimited ? 'No balance limit' : `${fmtDays(t.accrualPerMonth)} days / month`}</td>
                  <td className="px-4 py-3 text-gray-700">{t.maxDaysPerYear != null ? fmtDays(t.maxDaysPerYear) : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{t.maxDaysPerRequest != null ? fmtDays(t.maxDaysPerRequest) : '—'}</td>
                  <td className="px-4 py-3 text-gray-700">{t.isPaid ? 'Paid' : 'Unpaid'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${t.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {t.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="space-x-3 px-4 py-3 text-right">
                      <button className="text-sm font-medium text-primary-600 hover:underline" onClick={() => setEditing(t)}>Edit</button>
                      <button className="text-sm font-medium text-gray-600 hover:underline" disabled={busy(toggle)} onClick={() => toggle.mutate(t)}>
                        {t.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        className="text-sm font-medium text-red-600 hover:underline"
                        disabled={busy(remove)}
                        onClick={() => { if (window.confirm(`Delete "${t.name}"? Types that already have requests are deactivated instead.`)) remove.mutate(t.id); }}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing && (
        <TypeModal
          type={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onDone={() => { setEditing(null); refresh(); }}
        />
      )}
    </div>
  );
}

function TypeModal({ type, onClose, onDone }: { type: LeaveType | null; onClose: () => void; onDone: () => void }) {
  const [name, setName] = useState(type?.name ?? '');
  const [description, setDescription] = useState(type?.description ?? '');
  const [accrual, setAccrual] = useState(String(type?.accrualPerMonth ?? 2));
  const [maxYear, setMaxYear] = useState(type?.maxDaysPerYear != null ? String(type.maxDaysPerYear) : '');
  const [maxRequest, setMaxRequest] = useState(type?.maxDaysPerRequest != null ? String(type.maxDaysPerRequest) : '');
  const [isPaid, setIsPaid] = useState(type?.isPaid ?? true);
  const [isUnlimited, setIsUnlimited] = useState(type?.isUnlimited ?? false);
  const [color, setColor] = useState(type?.color ?? '#3b82f6');
  const [error, setError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        accrualPerMonth: isUnlimited ? 0 : Number(accrual) || 0,
        maxDaysPerYear: maxYear === '' ? null : Number(maxYear),
        maxDaysPerRequest: maxRequest === '' ? null : Number(maxRequest),
        isPaid,
        isUnlimited,
        color,
      };
      return type ? leaveApi.updateType(type.id, body) : leaveApi.createType(body);
    },
    onSuccess: onDone,
    onError: (e) => setError(errMsg(e)),
  });

  return (
    <Modal title={type ? 'Edit leave type' : 'Add leave type'} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Name"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description (optional)"><input className={inputCls} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isUnlimited} onChange={(e) => setIsUnlimited(e.target.checked)} />
          No balance limit (e.g. unpaid or maternity leave)
        </label>
        {!isUnlimited && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Days earned per month"><input type="number" step="0.25" min="0" className={inputCls} value={accrual} onChange={(e) => setAccrual(e.target.value)} /></Field>
            <Field label="Max days per year" hint="Leave blank for no cap"><input type="number" min="0" className={inputCls} value={maxYear} onChange={(e) => setMaxYear(e.target.value)} /></Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Max days per request" hint="Leave blank for no cap"><input type="number" min="0" className={inputCls} value={maxRequest} onChange={(e) => setMaxRequest(e.target.value)} /></Field>
          <Field label="Calendar colour"><input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-gray-300 bg-white p-1" value={color} onChange={(e) => setColor(e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Paid leave
        </label>
        <ErrorBanner message={error} />
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={onClose}>Close</button>
          <button className={btnPrimary} disabled={!name.trim() || busy(save)} onClick={() => { setError(null); save.mutate(); }}>
            {busy(save) ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
