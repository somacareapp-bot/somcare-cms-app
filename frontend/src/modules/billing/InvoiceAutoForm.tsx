/**
 * InvoiceAutoForm
 * ───────────────
 * Auto-loads lab orders + dispensed prescriptions for a visit,
 * pre-populates editable line items, and lets the receptionist
 * tweak rows before saving.
 *
 * Usage:
 *   <InvoiceAutoForm
 *     visitId={visit.id}
 *     patientName={patient.fullName}
 *     onSave={handleSaveInvoice}
 *     onCancel={() => setShowForm(false)}
 *   />
 */
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { billingApi } from '../../services/api';

interface LineItem {
  description: string;
  qty: number;
  unitPrice: number;
  category: 'lab' | 'pharmacy' | 'consultation' | 'other';
}

interface VisitSummary {
  appointmentFee: number;
  labItems: { name: string; price: number }[];
  labTotal: number;
}

interface Props {
  visitId: string;
  patientName: string;
  onSave: (items: LineItem[], notes: string) => void;
  onCancel: () => void;
}

const CAT_STYLE: Record<LineItem['category'], string> = {
  lab:          'bg-blue-50   text-blue-700   border-blue-200',
  pharmacy:     'bg-green-50  text-green-700  border-green-200',
  consultation: 'bg-purple-50 text-purple-700 border-purple-200',
  other:        'bg-gray-50   text-gray-600   border-gray-200',
};

export function InvoiceAutoForm({ visitId, patientName, onSave, onCancel }: Props) {
  const [items,  setItems]  = useState<LineItem[]>([]);
  const [notes,  setNotes]  = useState('');
  const [seeded, setSeeded] = useState(false);

  const { data: summary, isLoading, isError, refetch } = useQuery({
    queryKey: ['billing', 'visitSummary', visitId],
    queryFn: async () => {
      const res = await billingApi.getVisitSummary(visitId);
      return res.data as VisitSummary;
    },
    enabled: !!visitId,
  });

  // Seed line items from the summary — runs once per visitId
  useEffect(() => {
    if (!summary || seeded) return;
    const rows: LineItem[] = [];

    if (summary.appointmentFee > 0)
      rows.push({
        description: 'Consultation / Appointment Fee',
        qty: 1,
        unitPrice: summary.appointmentFee,
        category: 'consultation',
      });

    for (const lab of summary.labItems)
      rows.push({ description: lab.name, qty: 1, unitPrice: lab.price, category: 'lab' });

    // Always have at least one blank row
    if (rows.length === 0)
      rows.push({ description: '', qty: 1, unitPrice: 0, category: 'other' });

    setItems(rows);
    setSeeded(true);
  }, [summary, seeded]);

  const update = (i: number, field: keyof LineItem, val: string | number) =>
    setItems(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));

  const addRow    = () => setItems(p => [...p, { description: '', qty: 1, unitPrice: 0, category: 'other' }]);
  const removeRow = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));

  const grandTotal = items.reduce((s, r) => s + r.qty * r.unitPrice, 0);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-clinical-400 text-sm">
        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
        Loading visit charges…
      </div>
    );

  if (isError)
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
        <span>Could not load visit summary.</span>
        <button onClick={() => refetch()} className="underline ml-4 font-medium">Retry</button>
      </div>
    );

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-clinical-900">New Invoice</h3>
          <p className="text-sm text-clinical-500">{patientName}</p>
        </div>
        <span className="text-xs font-mono text-clinical-400">Visit {visitId.slice(0, 8)}…</span>
      </div>

      {/* Auto-loaded summary badges */}
      {summary && (
        <div className="flex flex-wrap gap-2 text-xs">
          {summary.labItems.length > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
              🔬 {summary.labItems.length} lab test{summary.labItems.length !== 1 ? 's' : ''} · ${summary.labTotal.toFixed(2)}
            </span>
          )}
          {summary.appointmentFee > 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-purple-50 text-purple-700 border-purple-200">
              🩺 Consultation · ${summary.appointmentFee.toFixed(2)}
            </span>
          )}
          {summary.labItems.length === 0 && summary.appointmentFee === 0 && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-yellow-50 text-yellow-700 border-yellow-200">
              ⚠ No charges found for this visit — add items manually
            </span>
          )}
        </div>
      )}

      {/* Line items table */}
      <div className="border border-clinical-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-clinical-50 text-clinical-500 text-xs uppercase tracking-wide">
              <th className="text-left px-3 py-2">Description</th>
              <th className="text-left px-3 py-2 w-28">Category</th>
              <th className="text-right px-3 py-2 w-16">Qty</th>
              <th className="text-right px-3 py-2 w-24">Unit $</th>
              <th className="text-right px-3 py-2 w-24">Total</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-clinical-100">
            {items.map((row, i) => (
              <tr key={i} className="hover:bg-clinical-50/40 transition-colors">
                <td className="px-3 py-1.5">
                  <input
                    className="w-full bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 rounded px-1 py-0.5"
                    value={row.description}
                    onChange={e => update(i, 'description', e.target.value)}
                    placeholder="Description"
                  />
                </td>
                <td className="px-3 py-1.5">
                  <select
                    value={row.category}
                    onChange={e => update(i, 'category', e.target.value as LineItem['category'])}
                    className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer focus:outline-none ${CAT_STYLE[row.category]}`}
                  >
                    <option value="lab">Lab</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="consultation">Consult</option>
                    <option value="other">Other</option>
                  </select>
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number" min={1}
                    className="w-full text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 rounded px-1 py-0.5"
                    value={row.qty}
                    onChange={e => update(i, 'qty', Number(e.target.value))}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <input
                    type="number" min={0} step={0.01}
                    className="w-full text-right bg-transparent focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-300 rounded px-1 py-0.5"
                    value={row.unitPrice}
                    onChange={e => update(i, 'unitPrice', Number(e.target.value))}
                  />
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-clinical-800">
                  ${(row.qty * row.unitPrice).toFixed(2)}
                </td>
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => removeRow(i)}
                    className="text-clinical-300 hover:text-red-500 text-xl leading-none transition-colors"
                    title="Remove row"
                  >×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add row + grand total */}
      <div className="flex items-center justify-between">
        <button
          onClick={addRow}
          className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          <span className="text-lg leading-none">+</span> Add line item
        </button>
        <div className="text-right">
          <p className="text-xs text-clinical-400 uppercase tracking-wide">Grand Total</p>
          <p className="text-2xl font-bold text-clinical-900">${grandTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Notes */}
      <textarea
        rows={2}
        className="w-full border border-clinical-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 placeholder-clinical-300 resize-none"
        placeholder="Notes (optional)…"
        value={notes}
        onChange={e => setNotes(e.target.value)}
      />

      {/* Save / Cancel */}
      <div className="flex justify-end gap-3 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-clinical-600 hover:bg-clinical-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => onSave(items, notes)}
          disabled={items.every(r => !r.description.trim())}
          className="px-5 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-40 transition-colors"
        >
          Save Invoice
        </button>
      </div>
    </div>
  );
}
