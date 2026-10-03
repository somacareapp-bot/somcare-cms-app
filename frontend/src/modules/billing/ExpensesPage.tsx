import { Fragment, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
  Receipt,
  CheckCircle2,
  XCircle,
  Send,
  Eye,
  Paperclip,
  X,
  Wallet,
  Clock,
  Download,
  DollarSign,
} from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import api, { expensesApi, expenseCategoriesApi } from '../../services/api';
import { ExpenseReceiptModal } from './ExpenseReceiptModal';
import * as XLSX from 'xlsx';

// Mirrors backend/src/expenses/entities/expense.entity.ts exactly.
type ExpenseStatus =
  | 'pending'
  | 'dept_head_approved'
  | 'dept_head_rejected'
  | 'approved'
  | 'rejected'
  | 'paid';

// category is now a plain string code resolved from the expense_categories table
interface ExpenseCategory { id: string; code: string; label: string; group: { label: string }; active: boolean; }

interface Expense {
  id: string;
  description: string;
  amount: string | number;
  category: string;
  date: string;
  notes?: string;
  receiptUrl?: string;
  status: ExpenseStatus;
  submittedById: string;
  submittedByName: string;
  deptHeadApprovedByName?: string;
  deptHeadApprovedAt?: string;
  deptHeadNotes?: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  adminNotes?: string;
  paidByName?: string;
  paidAt?: string;
  paidNotes?: string;
  createdAt: string;
}

const STATUS_META: Record<ExpenseStatus, { label: string; cls: string; dot: string }> = {
  pending: { label: 'Awaiting Dept Head', cls: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200', dot: 'bg-blue-500' },
  dept_head_approved: { label: 'Awaiting Approval', cls: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200', dot: 'bg-indigo-500' },
  dept_head_rejected: { label: 'Rejected by Dept Head', cls: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200', dot: 'bg-red-500' },
  approved: { label: 'Awaiting Payment', cls: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200', dot: 'bg-sky-500' },
  rejected: { label: 'Rejected', cls: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200', dot: 'bg-red-500' },
  paid: { label: 'Paid', cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200', dot: 'bg-emerald-500' },
};

// Never crash the page on a status this file doesn't know about yet.
function metaOf(status: string) {
  return (
    (STATUS_META as Record<string, { label: string; cls: string; dot: string }>)[status] ?? {
      label: status,
      cls: 'bg-clinical-100 text-clinical-600 ring-1 ring-inset ring-clinical-200',
      dot: 'bg-clinical-400',
    }
  );
}

function fmt(n: string | number) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function initials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || name[0]?.toUpperCase() || '?';
}

function isImageDataUrl(url?: string) {
  return !!url && url.startsWith('data:image/');
}

const inputCls =
  'border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-colors';

const emptyDraft = {
  date: todayStr(),
  category: '',
  description: '',
  amount: '',
  notes: '',
  receiptUrl: '',
};

export function ExpensesPage() {
  const { user, hasRole } = useAuthStore();
  const isAccountant = hasRole('accountant');
  const isAdmin = hasRole('administrator');
  const queryClient = useQueryClient();

  // Live categories from the expense_categories table
  const { data: categoryData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoriesApi.getAll().then((r) => r.data as ExpenseCategory[]),
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoryData ?? [];

  const [draft, setDraft] = useState(emptyDraft);
  const [hasReceipt, setHasReceipt] = useState(false);
  const [filter, setFilter] = useState<'mine' | 'depthead' | 'approval' | 'payment' | 'all'>(
    isAdmin ? 'approval' : isAccountant ? 'payment' : 'mine',
  );
  const [actionRow, setActionRow] = useState<{ id: string; type: 'reject' | 'deptreject' } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [viewExpense, setViewExpense] = useState<Expense | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Server does the status/submittedById filtering — see expenses.controller.ts getAll().
  const queryParams = useMemo(() => {
    if (filter === 'mine') return { status: undefined, submittedById: user?.id };
    if (filter === 'depthead') return { status: 'pending', submittedById: undefined };
    if (filter === 'approval') return { status: 'dept_head_approved', submittedById: undefined };
    if (filter === 'payment') return { status: 'approved', submittedById: undefined };
    return { status: undefined, submittedById: undefined };
  }, [filter, user?.id]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['expenses', queryParams],
    queryFn: () => expensesApi.getAll(queryParams.status, queryParams.submittedById).then((r) => r.data as Expense[]),
  });
  const { data: deptQueueData } = useQuery({
    queryKey: ['expenses', 'dept-head-queue'],
    queryFn: () => expensesApi.getDeptHeadQueue().then((r) => r.data as Expense[]),
  });
  // Heads: anyone linked to an org chart box gets the review tab even when the queue is empty.
  const { data: isApprover } = useQuery({
    queryKey: ['expenses', 'is-approver'],
    queryFn: () => api.get('/api/expenses/is-approver').then((r) => r.data === true),
  });
  // The review tab shows only THIS head's queue, not every pending expense.
  const expenses = filter === 'depthead' ? (deptQueueData ?? []) : (data ?? []);
  const filteredExpenses = expenses.filter((e) => {
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });
  const hasDateRange = !!(dateFrom || dateTo);

  // Expenses this user can act on as department head (declared before
  // pendingMyAction, which uses deptQueueData).
  const deptQueueIds = new Set((deptQueueData ?? []).map((e) => e.id));
  const hasDeptQueue = (deptQueueData ?? []).length > 0;

  const deptReviewMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: 'approve' | 'reject'; notes?: string }) =>
      expensesApi.deptHeadReview(id, decision, notes),
    onSuccess: () => {
      setActionRow(null);
      setNoteDraft('');
      invalidate();
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: 'approve' | 'reject'; notes?: string }) =>
      expensesApi.approve(id, decision, notes),
    onSuccess: () => {
      setActionRow(null);
      setNoteDraft('');
      invalidate();
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => expensesApi.markPaid(id),
    onSuccess: invalidate,
  });

  // Totals badge cards always reflect ALL expenses regardless of the active
  // tab filter, so a second unfiltered query backs them.
  const { data: allData } = useQuery({
    queryKey: ['expenses', 'all-for-totals'],
    queryFn: () => expensesApi.getAll().then((r) => r.data as Expense[]),
  });
  const allExpenses = allData ?? [];
  const rangeAllExpenses = allExpenses.filter((e) => {
    if (dateFrom && e.date < dateFrom) return false;
    if (dateTo && e.date > dateTo) return false;
    return true;
  });
  const totalInRange = rangeAllExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const total = allExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const thisMonth = todayStr().slice(0, 7);
  const totalThisMonth = allExpenses
    .filter((e) => e.date.startsWith(thisMonth))
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const pendingMyAction = allExpenses.filter((e) => {
    if (isAdmin && e.status === 'dept_head_approved') return true;
    if ((isAccountant || isAdmin) && e.status === 'approved') return true;
    return false;
  }).length + (deptQueueData ?? []).length;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
  }

  const createMutation = useMutation({
    mutationFn: () =>
      expensesApi.create({
        description: draft.description,
        amount: parseFloat(draft.amount) || 0,
        category: draft.category,
        date: draft.date,
        notes: draft.notes || undefined,
        receiptUrl: draft.receiptUrl || undefined,
      }),
    onSuccess: () => {
      setDraft(emptyDraft);
      setHasReceipt(false);
      invalidate();
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => expensesApi.remove(id),
    onSuccess: invalidate,
  });

  const tabs: { key: typeof filter; label: string; show: boolean }[] = [
    { key: 'mine', label: 'My Submissions', show: true },
    { key: 'depthead', label: 'Awaiting My Review', show: hasDeptQueue || !!isApprover },
    { key: 'approval', label: 'Awaiting My Approval', show: isAdmin },
    { key: 'payment', label: 'Awaiting Payment', show: isAccountant || isAdmin },
    { key: 'all', label: 'All', show: true },
  ];

  function handleReceiptFile(file: File | null | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setDraft((d) => ({ ...d, receiptUrl: (reader.result as string) || '' }));
    reader.readAsDataURL(file);
  }

  function exportToExcel() {
    const rows = filteredExpenses.map((e) => ({
      Date: e.date,
      Category: categories.find((c) => c.code === e.category)?.label ?? e.category,
      Description: e.description || '',
      'Submitted By': e.submittedByName || '',
      Status: metaOf(e.status).label,
      'Dept Head': e.deptHeadApprovedByName || '',
      'Approved By': e.approvedByName || '',
      'Paid By': e.paidByName || '',
      Notes: e.paidNotes || e.adminNotes || e.deptHeadNotes || e.notes || '',
      Amount: Number(e.amount),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
      { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 18 },
      { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    const rangeSuffix = dateFrom || dateTo ? `_${dateFrom || 'start'}_to_${dateTo || 'now'}` : '';
    XLSX.writeFile(wb, `expenses${rangeSuffix}_${todayStr()}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Expenses</h1>
          <p className="text-clinical-500 text-sm mt-1">Submit, review, approve, and pay facility expenses.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-clinical-200 px-3 py-2 shadow-sm">
          <span className="text-xs font-semibold text-clinical-500">Date range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputCls}
            style={{ flex: '0 1 150px' }}
          />
          <span className="text-xs text-clinical-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputCls}
            style={{ flex: '0 1 150px' }}
          />
          {hasDateRange && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs font-semibold text-clinical-400 hover:text-clinical-600 underline"
            >
              Clear
            </button>
          )}
          <button
            onClick={exportToExcel}
            disabled={filteredExpenses.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-clinical-200 text-clinical-700 hover:border-primary-400 hover:text-primary-600 disabled:opacity-40 transition-colors"
          >
            <Download size={13} /> Export to Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-clinical-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-rose-500 shadow-sm shadow-rose-200">
            <Receipt size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-clinical-500 font-medium">{hasDateRange ? 'Total (Selected Range)' : 'Total Recorded'}</p>
            <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(hasDateRange ? totalInRange : total)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-clinical-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-indigo-500 shadow-sm shadow-indigo-200">
            <Wallet size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-clinical-500 font-medium">This Month</p>
            <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(totalThisMonth)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-clinical-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="p-3 rounded-xl bg-amber-500 shadow-sm shadow-amber-200">
            <Clock size={22} className="text-white" />
          </div>
          <div>
            <p className="text-sm text-clinical-500 font-medium">Pending My Action</p>
            <p className="text-2xl font-bold text-clinical-900 mt-0.5">{pendingMyAction}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-clinical-200 p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-clinical-800 mb-3">New Expense</h3>
        <div className="flex flex-wrap gap-2 items-start">
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className={inputCls}
            style={{ flex: '0 1 150px' }}
          />
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className={inputCls}
            style={{ flex: '0 1 220px' }}
          >
            <option value="">— Category —</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.group.label} › {c.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Description"
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={inputCls}
            style={{ flex: '1 1 200px', minWidth: '160px' }}
          />
          <input
            type="number"
            placeholder="Amount"
            value={draft.amount}
            onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className={inputCls}
            style={{ flex: '0 1 110px' }}
          />
        </div>

        <div className="flex flex-wrap gap-2 items-start mt-2">
          <input
            placeholder="Notes (optional)"
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            className={inputCls}
            style={{ flex: '1 1 220px', minWidth: '180px' }}
          />
          <div className="flex flex-col gap-1.5" style={{ flex: '1 1 220px', minWidth: '180px' }}>
            <label className="flex items-center gap-2 text-xs font-medium text-clinical-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasReceipt}
                onChange={(e) => {
                  setHasReceipt(e.target.checked);
                  if (!e.target.checked) setDraft((d) => ({ ...d, receiptUrl: '' }));
                }}
                className="w-3.5 h-3.5 rounded border-clinical-300 text-primary-600 focus:ring-primary-500"
              />
              Attach receipt
            </label>
            {hasReceipt && (
              <label className="flex items-center gap-2 border border-dashed border-clinical-300 rounded-lg px-2.5 py-2 text-xs text-clinical-500 cursor-pointer hover:border-primary-400 hover:text-primary-600 transition-colors">
                <Paperclip size={13} className="flex-shrink-0" />
                <span className="truncate">{draft.receiptUrl ? 'Receipt attached ✓' : 'Choose file…'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />
              </label>
            )}
          </div>
        </div>

        {createMutation.isError && (
          <p className="text-xs text-red-600 mt-2">Couldn't submit — check the required fields and try again.</p>
        )}

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => createMutation.mutate()}
            disabled={!draft.date || !draft.amount || !draft.description || !draft.category || createMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 shadow-sm shadow-primary-200 transition-colors"
          >
            <Send size={13} /> {createMutation.isPending ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-clinical-200 p-5 shadow-sm">
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  filter === t.key ? 'bg-primary-600 text-white shadow-sm shadow-primary-200' : 'bg-clinical-100 text-clinical-600 hover:bg-clinical-200'
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>

        {isLoading ? (
          <p className="text-sm text-clinical-400 text-center py-8">Loading…</p>
        ) : isError ? (
          <p className="text-sm text-red-500 text-center py-8">Couldn't load expenses. Try refreshing.</p>
        ) : filteredExpenses.length === 0 ? (
          <p className="text-sm text-clinical-400 text-center py-8">No expenses here.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-5 py-2 font-semibold">Category</th>
                  <th className="px-5 py-2 font-semibold">Description</th>
                  <th className="px-5 py-2 font-semibold">Submitted By</th>
                  <th className="px-5 py-2 font-semibold">Receipt</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold text-right">Amount</th>
                  <th className="px-5 py-2 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => {
                  const meta = metaOf(e.status);
                  const canDeptReview = deptQueueIds.has(e.id) && e.status === 'pending';
                  const canApprove = isAdmin && e.status === 'dept_head_approved';
                  const canMarkPaid = (isAccountant || isAdmin) && e.status === 'approved';
                  const lastNote = e.paidNotes || e.adminNotes || e.deptHeadNotes;

                  return (
                    <Fragment key={e.id}>
                      <tr className="border-t border-clinical-50 align-top hover:bg-clinical-50/50 transition-colors">
                        <td className="px-5 py-3 text-clinical-600">{e.date}</td>
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-clinical-100 text-clinical-600 capitalize">
                            {categories.find((c) => c.code === e.category)?.label ?? e.category}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-clinical-500">{e.description || '—'}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                              {initials(e.submittedByName)}
                            </span>
                            <span className="text-clinical-500">{e.submittedByName || '—'}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {e.receiptUrl ? (
                              <a
                              href={e.receiptUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary-600 text-xs font-semibold underline"
                            >
                              View
                            </a>
                          ) : (
                            <span className="text-clinical-300 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                            {meta.label}
                          </span>
                          {lastNote && <p className="text-[11px] text-clinical-400 mt-1 max-w-[160px]">{lastNote}</p>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-clinical-900">${fmt(e.amount)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            <button
                              onClick={() => setViewExpense(e)}
                              className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-500 hover:border-primary-400 hover:text-primary-600 inline-flex items-center justify-center transition-colors"
                              title="View details"
                            >
                              <Eye size={13} />
                            </button>
                            {canDeptReview && (
                              <>
                                <button
                                  onClick={() => deptReviewMutation.mutate({ id: e.id, decision: 'approve' })}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-sky-600 hover:border-sky-400 inline-flex items-center justify-center transition-colors"
                                  title="Approve (Dept Head)"
                                >
                                  <CheckCircle2 size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setActionRow({ id: e.id, type: 'deptreject' });
                                    setNoteDraft('');
                                  }}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-red-500 hover:border-red-400 inline-flex items-center justify-center transition-colors"
                                  title="Reject (Dept Head)"
                                >
                                  <XCircle size={13} />
                                </button>
                              </>
                            )}
                            {canApprove && (
                              <>
                                <button
                                  onClick={() => approveMutation.mutate({ id: e.id, decision: 'approve' })}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-emerald-600 hover:border-emerald-400 inline-flex items-center justify-center transition-colors"
                                  title="Approve"
                                >
                                  <CheckCircle2 size={13} />
                                </button>
                                <button
                                  onClick={() => {
                                    setActionRow({ id: e.id, type: 'reject' });
                                    setNoteDraft('');
                                  }}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-red-500 hover:border-red-400 inline-flex items-center justify-center transition-colors"
                                  title="Reject"
                                >
                                  <XCircle size={13} />
                                </button>
                              </>
                            )}
                            {canMarkPaid && (
                              <button
                                onClick={() => markPaidMutation.mutate(e.id)}
                                disabled={markPaidMutation.isPending}
                                className="w-8 h-8 rounded-lg border border-clinical-200 text-primary-600 hover:border-primary-400 inline-flex items-center justify-center transition-colors disabled:opacity-40"
                                title="Mark as Paid"
                              >
                                <DollarSign size={13} />
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => removeMutation.mutate(e.id)}
                                className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-400 hover:border-red-400 hover:text-red-500 inline-flex items-center justify-center transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {actionRow?.id === e.id && (
                        <tr key={`${e.id}-action`} className="bg-clinical-50/60">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={noteDraft}
                                onChange={(ev) => setNoteDraft(ev.target.value)}
                                placeholder="Reason for rejection (required)"
                                className={`${inputCls} flex-1`}
                              />
                              <button
                                disabled={!noteDraft.trim()}
                                onClick={() => {
                                  const notes = noteDraft.trim();
                                  if (actionRow.type === 'reject') {
                                    approveMutation.mutate({ id: e.id, decision: 'reject', notes });
                                  } else {
                                    deptReviewMutation.mutate({ id: e.id, decision: 'reject', notes });
                                  }
                                }}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-clinical-800 text-white hover:bg-clinical-900 disabled:opacity-40"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setActionRow(null)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold border border-clinical-200 text-clinical-500 hover:bg-white"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ExpenseReceiptModal expense={viewExpense} onClose={() => setViewExpense(null)} />
    </div>
  );
}
