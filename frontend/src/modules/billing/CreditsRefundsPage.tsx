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
