#!/bin/bash
set -e
echo "📁 Working directory: $(pwd)"

BACKUP_DIR="frontend/src/modules/billing/.backups"
mkdir -p "$BACKUP_DIR"
TS=$(date +%Y%m%d_%H%M%S)

backup_if_exists() {
  if [ -f "$1" ]; then
    cp "$1" "$BACKUP_DIR/$(basename "$1").$TS.bak"
    echo "✅ Backup saved → $BACKUP_DIR/$(basename "$1").$TS.bak"
  fi
}

mkdir -p frontend/src/modules/billing

# ── Expenses ─────────────────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/ExpensesPage.tsx"
cat > frontend/src/modules/billing/ExpensesPage.tsx << 'FILEEOF'
import { useState } from 'react';
import { Plus, Trash2, Receipt } from 'lucide-react';

interface Expense {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  paidBy: string;
}

const CATEGORIES = ['Utilities', 'Salaries', 'Supplies', 'Maintenance', 'Rent', 'Transport', 'Other'];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [draft, setDraft] = useState({ date: '', category: CATEGORIES[0], description: '', amount: '', paidBy: '' });

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const totalThisMonth = expenses.filter((e) => e.date.startsWith(thisMonth)).reduce((sum, e) => sum + e.amount, 0);

  const addExpense = () => {
    if (!draft.date || !draft.amount) return;
    setExpenses((prev) => [
      { id: crypto.randomUUID(), date: draft.date, category: draft.category, description: draft.description, amount: parseFloat(draft.amount) || 0, paidBy: draft.paidBy },
      ...prev,
    ]);
    setDraft({ date: '', category: CATEGORIES[0], description: '', amount: '', paidBy: '' });
  };

  const removeExpense = (id: string) => setExpenses((prev) => prev.filter((e) => e.id !== id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900">Expenses</h1>
        <p className="text-clinical-500 text-sm mt-1">Track and record facility expenses.</p>
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
          <p className="text-sm text-clinical-500 font-medium">Entries</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">{expenses.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-3">Add Expense</h3>
        <div className="flex flex-wrap gap-2 items-start">
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 150px' }} />
          <select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 140px' }}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input placeholder="Description" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '1 1 200px', minWidth: '160px' }} />
          <input type="number" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 110px' }} />
          <input placeholder="Paid by" value={draft.paidBy} onChange={(e) => setDraft({ ...draft, paidBy: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 130px' }} />
          <button onClick={addExpense} disabled={!draft.date || !draft.amount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-4">Expense Records</h3>
        {expenses.length === 0 ? (
          <p className="text-sm text-clinical-400 text-center py-8">No expenses recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Category</th>
                <th className="px-5 py-2 font-semibold">Description</th>
                <th className="px-5 py-2 font-semibold">Paid By</th>
                <th className="px-5 py-2 font-semibold text-right">Amount</th>
                <th className="px-5 py-2 font-semibold text-right">Action</th>
              </tr></thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-t border-clinical-50">
                    <td className="px-5 py-3 text-clinical-600">{e.date}</td>
                    <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-clinical-100 text-clinical-600">{e.category}</span></td>
                    <td className="px-5 py-3 text-clinical-500">{e.description || '—'}</td>
                    <td className="px-5 py-3 text-clinical-500">{e.paidBy || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-clinical-900">${fmt(e.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => removeExpense(e.id)} className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-400 hover:border-red-400 hover:text-red-500 inline-flex items-center justify-center">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-clinical-400 text-center">
        Entries are kept in this browser session only — connect this page to a backend endpoint to persist expenses.
      </p>
    </div>
  );
}
FILEEOF
echo "✅ ExpensesPage.tsx"

# ── Credits & Refunds ───────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/CreditsRefundsPage.tsx"
cat > frontend/src/modules/billing/CreditsRefundsPage.tsx << 'FILEEOF'
import { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';

interface Entry {
  id: string;
  type: 'credit' | 'refund';
  date: string;
  patientName: string;
  invoiceRef: string;
  amount: number;
  reason: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CreditsRefundsPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState({ type: 'credit' as 'credit' | 'refund', date: '', patientName: '', invoiceRef: '', amount: '', reason: '' });

  const totalCredits = entries.filter((e) => e.type === 'credit').reduce((s, e) => s + e.amount, 0);
  const totalRefunds = entries.filter((e) => e.type === 'refund').reduce((s, e) => s + e.amount, 0);

  const addEntry = () => {
    if (!draft.date || !draft.amount) return;
    setEntries((prev) => [
      { id: crypto.randomUUID(), type: draft.type, date: draft.date, patientName: draft.patientName, invoiceRef: draft.invoiceRef, amount: parseFloat(draft.amount) || 0, reason: draft.reason },
      ...prev,
    ]);
    setDraft({ type: 'credit', date: '', patientName: '', invoiceRef: '', amount: '', reason: '' });
  };

  const removeEntry = (id: string) => setEntries((prev) => prev.filter((e) => e.id !== id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900">Credits & Refunds</h1>
        <p className="text-clinical-500 text-sm mt-1">Record patient credits and refunds against invoices.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-teal-500"><RotateCcw size={22} className="text-white" /></div>
          <div>
            <p className="text-sm text-clinical-500 font-medium">Total Credits</p>
            <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(totalCredits)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm text-clinical-500 font-medium">Total Refunds</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(totalRefunds)}</p>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm text-clinical-500 font-medium">Entries</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">{entries.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-3">Add Credit / Refund</h3>
        <div className="flex flex-wrap gap-2 items-start">
          <select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as 'credit' | 'refund' })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 100px' }}>
            <option value="credit">Credit</option>
            <option value="refund">Refund</option>
          </select>
          <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 150px' }} />
          <input placeholder="Patient name" value={draft.patientName} onChange={(e) => setDraft({ ...draft, patientName: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '1 1 150px', minWidth: '140px' }} />
          <input placeholder="Invoice #" value={draft.invoiceRef} onChange={(e) => setDraft({ ...draft, invoiceRef: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 110px' }} />
          <input type="number" placeholder="Amount" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 110px' }} />
          <input placeholder="Reason" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '1 1 150px', minWidth: '140px' }} />
          <button onClick={addEntry} disabled={!draft.date || !draft.amount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-4">Records</h3>
        {entries.length === 0 ? (
          <p className="text-sm text-clinical-400 text-center py-8">No credits or refunds recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-2 font-semibold">Date</th>
                <th className="px-5 py-2 font-semibold">Type</th>
                <th className="px-5 py-2 font-semibold">Patient</th>
                <th className="px-5 py-2 font-semibold">Invoice</th>
                <th className="px-5 py-2 font-semibold">Reason</th>
                <th className="px-5 py-2 font-semibold text-right">Amount</th>
                <th className="px-5 py-2 font-semibold text-right">Action</th>
              </tr></thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-clinical-50">
                    <td className="px-5 py-3 text-clinical-600">{e.date}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${e.type === 'credit' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {e.type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-clinical-900 font-medium">{e.patientName || '—'}</td>
                    <td className="px-5 py-3 text-clinical-500">{e.invoiceRef || '—'}</td>
                    <td className="px-5 py-3 text-clinical-500">{e.reason || '—'}</td>
                    <td className="px-5 py-3 text-right font-semibold text-clinical-900">${fmt(e.amount)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => removeEntry(e.id)} className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-400 hover:border-red-400 hover:text-red-500 inline-flex items-center justify-center">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-clinical-400 text-center">
        Entries are kept in this browser session only — connect this page to a backend endpoint to persist records.
      </p>
    </div>
  );
}
FILEEOF
echo "✅ CreditsRefundsPage.tsx"

# ── Bed Rent ─────────────────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/BedRentPage.tsx"
cat > frontend/src/modules/billing/BedRentPage.tsx << 'FILEEOF'
import { useState } from 'react';
import { Plus, Trash2, BedDouble } from 'lucide-react';

interface BedCharge {
  id: string;
  bedNumber: string;
  patientName: string;
  admissionDate: string;
  dailyRate: string;
  days: string;
  status: 'active' | 'discharged';
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function BedRentPage() {
  const [charges, setCharges] = useState<BedCharge[]>([]);
  const [draft, setDraft] = useState({ bedNumber: '', patientName: '', admissionDate: '', dailyRate: '', days: '', status: 'active' as 'active' | 'discharged' });

  const total = charges.reduce((s, c) => s + (parseFloat(c.dailyRate) || 0) * (parseFloat(c.days) || 0), 0);
  const activeCount = charges.filter((c) => c.status === 'active').length;

  const addCharge = () => {
    if (!draft.bedNumber || !draft.dailyRate) return;
    setCharges((prev) => [{ id: crypto.randomUUID(), ...draft }, ...prev]);
    setDraft({ bedNumber: '', patientName: '', admissionDate: '', dailyRate: '', days: '', status: 'active' });
  };

  const removeCharge = (id: string) => setCharges((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900">Bed Rent</h1>
        <p className="text-clinical-500 text-sm mt-1">Track per-bed daily charges for admitted patients.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500"><BedDouble size={22} className="text-white" /></div>
          <div>
            <p className="text-sm text-clinical-500 font-medium">Active Beds</p>
            <p className="text-2xl font-bold text-clinical-900 mt-0.5">{activeCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm text-clinical-500 font-medium">Total Charged</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(total)}</p>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <p className="text-sm text-clinical-500 font-medium">Records</p>
          <p className="text-2xl font-bold text-clinical-900 mt-0.5">{charges.length}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-3">Add Bed Charge</h3>
        <div className="flex flex-wrap gap-2 items-start">
          <input placeholder="Bed #" value={draft.bedNumber} onChange={(e) => setDraft({ ...draft, bedNumber: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 90px' }} />
          <input placeholder="Patient name" value={draft.patientName} onChange={(e) => setDraft({ ...draft, patientName: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '1 1 150px', minWidth: '140px' }} />
          <input type="date" value={draft.admissionDate} onChange={(e) => setDraft({ ...draft, admissionDate: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 150px' }} />
          <input type="number" placeholder="Daily rate" value={draft.dailyRate} onChange={(e) => setDraft({ ...draft, dailyRate: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 100px' }} />
          <input type="number" placeholder="Days" value={draft.days} onChange={(e) => setDraft({ ...draft, days: e.target.value })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 80px' }} />
          <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as 'active' | 'discharged' })}
            className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500" style={{ flex: '0 1 110px' }}>
            <option value="active">Active</option>
            <option value="discharged">Discharged</option>
          </select>
          <button onClick={addCharge} disabled={!draft.bedNumber || !draft.dailyRate}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40">
            <Plus size={13} /> Add
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-5">
        <h3 className="text-sm font-semibold text-clinical-800 mb-4">Bed Charges</h3>
        {charges.length === 0 ? (
          <p className="text-sm text-clinical-400 text-center py-8">No bed charges recorded yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-clinical-400 text-xs uppercase tracking-wide">
                <th className="px-5 py-2 font-semibold">Bed #</th>
                <th className="px-5 py-2 font-semibold">Patient</th>
                <th className="px-5 py-2 font-semibold">Admission Date</th>
                <th className="px-5 py-2 font-semibold text-right">Daily Rate</th>
                <th className="px-5 py-2 font-semibold text-right">Days</th>
                <th className="px-5 py-2 font-semibold text-right">Total</th>
                <th className="px-5 py-2 font-semibold">Status</th>
                <th className="px-5 py-2 font-semibold text-right">Action</th>
              </tr></thead>
              <tbody>
                {charges.map((c) => {
                  const rowTotal = (parseFloat(c.dailyRate) || 0) * (parseFloat(c.days) || 0);
                  return (
                    <tr key={c.id} className="border-t border-clinical-50">
                      <td className="px-5 py-3 font-medium text-clinical-900">{c.bedNumber}</td>
                      <td className="px-5 py-3 text-clinical-600">{c.patientName || '—'}</td>
                      <td className="px-5 py-3 text-clinical-500">{c.admissionDate || '—'}</td>
                      <td className="px-5 py-3 text-right text-clinical-500">${fmt(parseFloat(c.dailyRate) || 0)}</td>
                      <td className="px-5 py-3 text-right text-clinical-500">{c.days || '—'}</td>
                      <td className="px-5 py-3 text-right font-semibold text-clinical-900">${fmt(rowTotal)}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${c.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-clinical-100 text-clinical-600'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => removeCharge(c.id)} className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-400 hover:border-red-400 hover:text-red-500 inline-flex items-center justify-center">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-clinical-400 text-center">
        Entries are kept in this browser session only — connect this page to a backend endpoint to persist charges.
      </p>
    </div>
  );
}
FILEEOF
echo "✅ BedRentPage.tsx"

# ── Reports landing ──────────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/AccountsReportsPage.tsx"
cat > frontend/src/modules/billing/AccountsReportsPage.tsx << 'FILEEOF'
import { useNavigate } from 'react-router-dom';
import { TrendingUp, ClipboardCheck, FileWarning, ChevronRight } from 'lucide-react';

const REPORTS = [
  { label: 'Profit & Loss', path: '/billing/reports/profit-loss', icon: TrendingUp, color: 'bg-green-600', description: 'Revenue vs. expenses over a selected period.' },
  { label: 'Daily Reconciliation', path: '/billing/reports/daily-reconciliation', icon: ClipboardCheck, color: 'bg-blue-600', description: 'Compare expected vs. actual cash at close of day.' },
  { label: 'Discount & Void Log', path: '/billing/reports/discount-void-log', icon: FileWarning, color: 'bg-amber-500', description: 'Audit trail of discounts applied and invoices voided.' },
];

export function AccountsReportsPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900">Reports</h1>
        <p className="text-clinical-500 text-sm mt-1">Financial reports for the accounts team.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {REPORTS.map((r) => {
          const Icon = r.icon;
          return (
            <button key={r.path} onClick={() => navigate(r.path)}
              className="bg-white rounded-xl border border-clinical-200 p-5 text-left hover:border-primary-300 hover:shadow-md transition-shadow">
              <div className={`p-3 rounded-xl ${r.color} inline-flex mb-3`}><Icon size={20} className="text-white" /></div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-clinical-900">{r.label}</p>
                <ChevronRight size={14} className="text-clinical-400" />
              </div>
              <p className="text-xs text-clinical-500 mt-1">{r.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
FILEEOF
echo "✅ AccountsReportsPage.tsx"

# ── Profit & Loss ─────────────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/ProfitLossPage.tsx"
cat > frontend/src/modules/billing/ProfitLossPage.tsx << 'FILEEOF'
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp } from 'lucide-react';

export function ProfitLossPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate('/billing/reports')} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mb-2">
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <h1 className="text-2xl font-bold text-clinical-900">Profit & Loss</h1>
        <p className="text-clinical-500 text-sm mt-1">Revenue vs. expenses over a selected period.</p>
      </div>
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
        <TrendingUp size={32} className="text-clinical-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-clinical-700">Not connected to a data source yet</p>
        <p className="text-xs text-clinical-400 mt-1 max-w-md mx-auto">
          This report needs a backend endpoint that aggregates revenue (paid invoices) against recorded
          expenses for a chosen date range. Once that endpoint exists, this page can render the comparison
          and chart instead of showing this placeholder.
        </p>
      </div>
    </div>
  );
}
FILEEOF
echo "✅ ProfitLossPage.tsx"

# ── Daily Reconciliation ─────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/DailyReconciliationPage.tsx"
cat > frontend/src/modules/billing/DailyReconciliationPage.tsx << 'FILEEOF'
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';

export function DailyReconciliationPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate('/billing/reports')} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mb-2">
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <h1 className="text-2xl font-bold text-clinical-900">Daily Reconciliation</h1>
        <p className="text-clinical-500 text-sm mt-1">Compare expected vs. actual cash at close of day.</p>
      </div>
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
        <ClipboardCheck size={32} className="text-clinical-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-clinical-700">Not connected to a data source yet</p>
        <p className="text-xs text-clinical-400 mt-1 max-w-md mx-auto">
          This report needs a backend endpoint that totals cash payments recorded per day and compares them
          against a manually entered closing count. Once that endpoint exists, this page can show the
          day-by-day reconciliation table.
        </p>
      </div>
    </div>
  );
}
FILEEOF
echo "✅ DailyReconciliationPage.tsx"

# ── Discount & Void Log ──────────────────────────────────────────────────
backup_if_exists "frontend/src/modules/billing/DiscountVoidLogPage.tsx"
cat > frontend/src/modules/billing/DiscountVoidLogPage.tsx << 'FILEEOF'
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileWarning } from 'lucide-react';

export function DiscountVoidLogPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate('/billing/reports')} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mb-2">
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <h1 className="text-2xl font-bold text-clinical-900">Discount & Void Log</h1>
        <p className="text-clinical-500 text-sm mt-1">Audit trail of discounts applied and invoices voided.</p>
      </div>
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
        <FileWarning size={32} className="text-clinical-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-clinical-700">Not connected to a data source yet</p>
        <p className="text-xs text-clinical-400 mt-1 max-w-md mx-auto">
          This log needs the backend to record who applied a discount or voided an invoice, when, and why.
          Once that audit trail is written on the backend, this page can list it chronologically.
        </p>
      </div>
    </div>
  );
}
FILEEOF
echo "✅ DiscountVoidLogPage.tsx"

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -la frontend/src/modules/billing/*.tsx | grep -E "Expenses|CreditsRefunds|BedRent|AccountsReports|ProfitLoss|DailyReconciliation|DiscountVoidLog"

echo ""
echo "🎉 Done. Start the dev server to preview:"
echo "   cd frontend && npm run dev"
