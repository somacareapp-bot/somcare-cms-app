#!/bin/bash
set -e

echo "📁 Working directory: $(pwd)"

# ── Locate the target files (search from current directory, skip node_modules) ──
EXPENSES_PATH=$(find . -path '*/node_modules' -prune -o -name 'ExpensesPage.tsx' -print -quit)
AUTH_PATH=$(find . -path '*/node_modules' -prune -o -name 'auth.store.ts' -print -quit)

if [ -z "$EXPENSES_PATH" ]; then
  echo "ERROR: could not find ExpensesPage.tsx anywhere under $(pwd)"
  exit 1
fi
if [ -z "$AUTH_PATH" ]; then
  echo "ERROR: could not find auth.store.ts anywhere under $(pwd)"
  exit 1
fi

echo "Found ExpensesPage.tsx at: $EXPENSES_PATH"
echo "Found auth.store.ts at:    $AUTH_PATH"

# ── Compute the correct relative import path via Node (reliable, avoids guessing) ──
REL_IMPORT=$(node -e "
const path = require('path');
const from = path.dirname(process.argv[1]);
let to = process.argv[2].replace(/\.(ts|tsx)\$/, '');
let rel = path.relative(from, to);
if (!rel.startsWith('.')) rel = './' + rel;
console.log(rel);
" "$EXPENSES_PATH" "$AUTH_PATH")

echo "Computed import path: $REL_IMPORT"

# ── Backup the existing file ──
BACKUP="${EXPENSES_PATH}.bak.$(date +%s)"
cp "$EXPENSES_PATH" "$BACKUP"
echo "Backed up existing file to: $BACKUP"

TMP_FILE=$(mktemp)

cat > "$TMP_FILE" <<'ENDOFFILE'
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Receipt, Upload, CheckCircle2, XCircle, RotateCcw, Send } from 'lucide-react';
import { useAuthStore } from '__AUTH_IMPORT__';

type ExpenseStatus = 'draft' | 'submitted' | 'accountant_reviewed' | 'approved' | 'rejected' | 'sent_back';

interface HistoryEntry {
  at: string;
  by: string;
  action: string;
  note?: string;
}

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
  receiptRequired: boolean;
  receiptFileName?: string;
  receiptDataUrl?: string;
  status: ExpenseStatus;
  submittedById?: string;
  submittedByName?: string;
  history: HistoryEntry[];
}

const CATEGORIES = ['Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Rent', 'Transport', 'Other'];

const EXPENSES_KEY = 'somcare.expenses.records';

function loadExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(EXPENSES_KEY);
    return raw ? (JSON.parse(raw) as Expense[]) : [];
  } catch {
    return [];
  }
}

function saveExpenses(expenses: Expense[]) {
  try {
    localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
  } catch {
    // ignore quota errors
  }
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_META: Record<ExpenseStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-clinical-100 text-clinical-600' },
  submitted: { label: 'Submitted', cls: 'bg-blue-100 text-blue-700' },
  accountant_reviewed: { label: 'Reviewed', cls: 'bg-indigo-100 text-indigo-700' },
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-700' },
  sent_back: { label: 'Sent Back', cls: 'bg-amber-100 text-amber-700' },
};

const inputCls =
  'border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500';

export function ExpensesPage() {
  const { user, hasRole } = useAuthStore();
  const isAccountant = hasRole('accountant');
  const isAdmin = hasRole('administrator');

  const [expenses, setExpenses] = useState<Expense[]>(() => loadExpenses());
  useEffect(() => {
    saveExpenses(expenses);
  }, [expenses]);

  const [draft, setDraft] = useState({
    date: '',
    category: CATEGORIES[0],
    description: '',
    amount: '',
    paidBy: '',
    receiptRequired: false,
    receiptFileName: undefined as string | undefined,
    receiptDataUrl: undefined as string | undefined,
  });

  const [filter, setFilter] = useState<'all' | 'mine' | 'review' | 'approval'>(
    isAdmin ? 'approval' : isAccountant ? 'review' : 'mine'
  );

  const [actionRow, setActionRow] = useState<{ id: string; type: 'reject' | 'sendback' } | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const thisMonth = todayStr().slice(0, 7);
  const totalThisMonth = expenses
    .filter((e) => e.date.startsWith(thisMonth))
    .reduce((sum, e) => sum + e.amount, 0);

  const pendingMyAction = expenses.filter((e) => {
    if (isAccountant && e.status === 'submitted') return true;
    if (isAdmin && e.status === 'accountant_reviewed') return true;
    return false;
  }).length;

  function logEntry(action: string, note?: string): HistoryEntry {
    return { at: new Date().toISOString(), by: user?.fullName || user?.username || 'Unknown', action, note };
  }

  function resetDraft() {
    setDraft({
      date: '',
      category: CATEGORIES[0],
      description: '',
      amount: '',
      paidBy: '',
      receiptRequired: false,
      receiptFileName: undefined,
      receiptDataUrl: undefined,
    });
  }

  function handleFile(file: File | null) {
    if (!file) {
      setDraft((d) => ({ ...d, receiptFileName: undefined, receiptDataUrl: undefined }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((d) => ({ ...d, receiptFileName: file.name, receiptDataUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  }

  function createExpense(status: ExpenseStatus) {
    if (!draft.date || !draft.amount) return;
    const entry: Expense = {
      id: crypto.randomUUID(),
      date: draft.date,
      category: draft.category,
      description: draft.description,
      amount: parseFloat(draft.amount) || 0,
      paidBy: draft.paidBy,
      receiptRequired: draft.receiptRequired,
      receiptFileName: draft.receiptFileName,
      receiptDataUrl: draft.receiptDataUrl,
      status,
      submittedById: user?.id,
      submittedByName: user?.fullName || user?.username,
      history: [logEntry(status === 'draft' ? 'Saved as draft' : 'Submitted for review')],
    };
    setExpenses((prev) => [entry, ...prev]);
    resetDraft();
  }

  function submitDraft(id: string) {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: 'submitted', history: [...e.history, logEntry('Submitted for review')] }
          : e
      )
    );
  }

  function accountantConfirm(id: string) {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? { ...e, status: 'accountant_reviewed', history: [...e.history, logEntry('Confirmed by accountant')] }
          : e
      )
    );
  }

  function adminDecide(id: string, decision: 'approved' | 'rejected' | 'sent_back', note: string) {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === id
          ? {
              ...e,
              status: decision,
              history: [
                ...e.history,
                logEntry(
                  decision === 'approved' ? 'Approved' : decision === 'rejected' ? 'Rejected' : 'Sent back',
                  note || undefined
                ),
              ],
            }
          : e
      )
    );
    setActionRow(null);
    setNoteDraft('');
  }

  const removeExpense = (id: string) => setExpenses((prev) => prev.filter((e) => e.id !== id));

  const visibleExpenses = useMemo(() => {
    if (filter === 'mine') return expenses.filter((e) => e.submittedById === user?.id);
    if (filter === 'review') return expenses.filter((e) => e.status === 'submitted');
    if (filter === 'approval') return expenses.filter((e) => e.status === 'accountant_reviewed');
    return expenses;
  }, [expenses, filter, user?.id]);

  const tabs: { key: typeof filter; label: string; show: boolean }[] = [
    { key: 'mine', label: 'My Submissions', show: true },
    { key: 'review', label: 'Awaiting My Review', show: isAccountant },
    { key: 'approval', label: 'Awaiting My Approval', show: isAdmin },
    { key: 'all', label: 'All', show: true },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900">Expenses</h1>
        <p className="text-clinical-500 text-sm mt-1">Submit, review, and approve facility expenses.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-rose-500"><Receipt size={22} className="text-white" /></div>
          <div>
            <p className="text-sm text-clinical-500 font-medium">Total Recorded</p>
            <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(total)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm text-clinical-500 font-medium">This Month</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(totalThisMonth)}</p>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm text-clinical-500 font-medium">Pending My Action</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">{pendingMyAction}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-3">New Expense</h3>
        <div className="flex flex-wrap gap-2 items-start">
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className={inputCls} style={{ flex: '0 1 150px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className={inputCls} style={{ flex: '0 1 140px' }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className={inputCls} style={{ flex: '1 1 200px', minWidth: '160px' }} />
          <input type="number" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className={inputCls} style={{ flex: '0 1 110px' }} />
          <input placeholder="Paid by" value={draft.paidBy} onChange={(e) => setDraft({ ...draft, paidBy: e.target.value })}
            className={inputCls} style={{ flex: '0 1 130px' }} />
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-clinical-50">
          <label className="flex items-center gap-1.5 text-xs font-medium text-clinical-700">
            <input type="checkbox" checked={draft.receiptRequired}
              onChange={(e) => setDraft({ ...draft, receiptRequired: e.target.checked, receiptFileName: undefined, receiptDataUrl: undefined })}
              className="rounded border-clinical-300" />
            Receipt required
          </label>
          {draft.receiptRequired && (
            <label className="flex items-center gap-1.5 text-xs text-primary-600 font-semibold cursor-pointer">
              <Upload size={13} />
              {draft.receiptFileName || 'Upload receipt'}
              <input type="file" accept="image/*,.pdf" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] || null)} />
            </label>
          )}
        </div>

        <div className="flex gap-2 mt-3">
          <button onClick={() => createExpense('draft')} disabled={!draft.date || !draft.amount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-clinical-200 text-clinical-600 hover:bg-clinical-50 disabled:opacity-40">
            <Plus size={13} /> Save Draft
          </button>
          <button onClick={() => createExpense('submitted')} disabled={!draft.date || !draft.amount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40">
            <Send size={13} /> Submit for Review
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.filter((t) => t.show).map((t) => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === t.key ? 'bg-primary-600 text-white' : 'bg-clinical-100 text-clinical-600 hover:bg-clinical-200'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {visibleExpenses.length === 0 ? (
          <p className="text-sm text-clinical-400 text-center py-8">No expenses here.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Category</th>
                <th className="px-5 py-2 font-semibold">Description</th>
                <th className="px-5 py-2 font-semibold">Submitted By</th>
                <th className="px-5 py-2 font-semibold">Receipt</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold text-right">Amount</th>
                <th className="px-5 py-2 font-semibold text-right">Action</th>
              </tr></thead>
              <tbody>
                {visibleExpenses.map((e) => {
                  const meta = STATUS_META[e.status];
                  const isMine = e.submittedById === user?.id;
                  const canResubmit = isMine && (e.status === 'draft' || e.status === 'sent_back');
                  const canReview = isAccountant && e.status === 'submitted';
                  const canDecide = isAdmin && e.status === 'accountant_reviewed';
                  const lastNote = [...e.history].reverse().find((h) => h.note)?.note;

                  return (
                    <Fragment key={e.id}>
                      <tr className="border-t border-clinical-50 align-top">
                        <td className="px-5 py-3 text-clinical-600">{e.date}</td>
                        <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-clinical-100 text-clinical-600">{e.category}</span></td>
                        <td className="px-5 py-3 text-clinical-500">{e.description || '—'}</td>
                        <td className="px-5 py-3 text-clinical-500">{e.submittedByName || '—'}</td>
                        <td className="px-5 py-3">
                          {e.receiptRequired ? (
                            e.receiptDataUrl ? (
                              <a href={e.receiptDataUrl} download={e.receiptFileName} className="text-primary-600 text-xs font-semibold underline">
                                {e.receiptFileName || 'View'}
                              </a>
                            ) : (
                              <span className="text-amber-600 text-xs font-semibold">Missing</span>
                            )
                          ) : (
                            <span className="text-clinical-300 text-xs">N/A</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${meta.cls}`}>{meta.label}</span>
                          {lastNote && <p className="text-[11px] text-clinical-400 mt-1 max-w-[160px]">{lastNote}</p>}
                        </td>
                        <td className="px-5 py-3 text-right font-semibold text-clinical-900">${fmt(e.amount)}</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-1.5 flex-wrap">
                            {canResubmit && (
                              <button onClick={() => submitDraft(e.id)}
                                className="w-8 h-8 rounded-lg border border-clinical-200 text-primary-600 hover:border-primary-400 inline-flex items-center justify-center" title="Submit">
                                <Send size={13} />
                              </button>
                            )}
                            {canReview && (
                              <button onClick={() => accountantConfirm(e.id)}
                                className="w-8 h-8 rounded-lg border border-clinical-200 text-indigo-600 hover:border-indigo-400 inline-flex items-center justify-center" title="Confirm review">
                                <CheckCircle2 size={13} />
                              </button>
                            )}
                            {canDecide && (
                              <>
                                <button onClick={() => adminDecide(e.id, 'approved', '')}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-emerald-600 hover:border-emerald-400 inline-flex items-center justify-center" title="Approve">
                                  <CheckCircle2 size={13} />
                                </button>
                                <button onClick={() => { setActionRow({ id: e.id, type: 'reject' }); setNoteDraft(''); }}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-red-500 hover:border-red-400 inline-flex items-center justify-center" title="Reject">
                                  <XCircle size={13} />
                                </button>
                                <button onClick={() => { setActionRow({ id: e.id, type: 'sendback' }); setNoteDraft(''); }}
                                  className="w-8 h-8 rounded-lg border border-clinical-200 text-amber-600 hover:border-amber-400 inline-flex items-center justify-center" title="Send back">
                                  <RotateCcw size={13} />
                                </button>
                              </>
                            )}
                            {(e.status === 'draft' && isMine) && (
                              <button onClick={() => removeExpense(e.id)}
                                className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-400 hover:border-red-400 hover:text-red-500 inline-flex items-center justify-center" title="Delete">
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {actionRow?.id === e.id && (
                        <tr className="bg-clinical-50/60">
                          <td colSpan={8} className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <input autoFocus value={noteDraft} onChange={(ev) => setNoteDraft(ev.target.value)}
                                placeholder={actionRow.type === 'reject' ? 'Reason for rejection (required)' : 'Reason for sending back (required)'}
                                className={`${inputCls} flex-1`} />
                              <button
                                disabled={!noteDraft.trim()}
                                onClick={() => adminDecide(e.id, actionRow.type === 'reject' ? 'rejected' : 'sent_back', noteDraft.trim())}
                                className="px-3 py-2 rounded-lg text-xs font-semibold bg-clinical-800 text-white hover:bg-clinical-900 disabled:opacity-40">
                                Confirm
                              </button>
                              <button onClick={() => setActionRow(null)}
                                className="px-3 py-2 rounded-lg text-xs font-semibold border border-clinical-200 text-clinical-500 hover:bg-white">
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

      <p className="text-xs text-clinical-400 text-center">
        Expenses are saved to this browser (localStorage) — connect this page to a backend endpoint to share across devices.
      </p>
    </div>
  );
}
ENDOFFILE

# ── Substitute the computed auth import path, then write into place ──
ESCAPED_REL_IMPORT=$(printf '%s' "$REL_IMPORT" | sed 's/[&/\]/\\&/g')
sed "s|__AUTH_IMPORT__|$ESCAPED_REL_IMPORT|" "$TMP_FILE" > "$EXPENSES_PATH"
rm -f "$TMP_FILE"

echo ""
echo "SUCCESS: ExpensesPage.tsx now has the full submit → accountant review → admin approve/reject/send-back workflow, with receipt checkbox + upload, and persists to localStorage."
echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
grep -n "ExpenseStatus\|useAuthStore\|receiptRequired\|accountantConfirm\|adminDecide\|EXPENSES_KEY" "$EXPENSES_PATH"

echo ""
echo "🎉 Done. Restart the dev server and clear the Vite cache:"
echo "   cd frontend && rm -rf node_modules/.vite && npm run dev"
echo ""
echo "If the import path looks wrong above, restore the backup with:"
echo "   cp \"$BACKUP\" \"$EXPENSES_PATH\""
