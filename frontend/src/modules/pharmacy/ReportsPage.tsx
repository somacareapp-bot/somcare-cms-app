import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BarChart2, ArrowLeft, ShoppingCart, RefreshCw, CreditCard,
  Loader2, AlertCircle, CheckCircle, Search, ChevronDown, ChevronUp, CornerDownLeft,
} from 'lucide-react';
import { pharmacyApi, pharmacyReturnsApi } from '../../services/api';

const fmt = (n: number) => `$${Number(n).toFixed(2)}`;

const REASON_LABELS: Record<string, string> = {
  wrong_medicine: 'Wrong Medicine',
  expired: 'Expired',
  damaged: 'Damaged',
  patient_refused: 'Patient Refused',
  other: 'Other',
};

type Tab = 'sales' | 'returns' | 'payments';
type ReturnSubTab = 'new' | 'history';

export default function ReportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>('sales');
  const [returnSub, setReturnSub] = useState<ReturnSubTab>('new');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | 'pos' | 'dispensing'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Return form state
  const [returnTarget, setReturnTarget] = useState<any | null>(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQty, setReturnQty] = useState('');
  const [reason, setReason] = useState('other');
  const [notes, setNotes] = useState('');
  const [formMsg, setFormMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['pharmacy-sales'],
    queryFn: () => pharmacyApi.getSales().then((r: any) => r.data ?? r),
  });

  const { data: dispensed = [] } = useQuery({
    queryKey: ['pharmacy', 'dispensing-history'],
    queryFn: async () => {
      const res = await pharmacyApi.getPrescriptions?.();
      const all = res?.data ?? [];
      return all.filter((p: any) => p.status === 'dispensed');
    },
    enabled: typeof pharmacyApi.getPrescriptions === 'function',
  });

  const { data: returns = [], isLoading: returnsLoading } = useQuery({
    queryKey: ['pharmacy-returns'],
    queryFn: () => pharmacyReturnsApi.getAll().then((r: any) => r.data ?? r),
  });

  const returnMut = useMutation({
    mutationFn: () =>
      pharmacyReturnsApi.create({
        type: returnTarget?._type === 'dispensing' ? 'rx' : 'pos',
        saleId: returnTarget?._type === 'pos' ? returnTarget.id : undefined,
        saleItemId: returnTarget?._type === 'pos' ? returnItemId : undefined,
        prescriptionId: returnTarget?._type === 'dispensing' ? returnTarget.id : undefined,
        quantity: Number(returnQty),
        reason,
        notes,
      }),
    onSuccess: () => {
      setFormMsg({ type: 'ok', text: 'Return recorded successfully.' });
      setReturnTarget(null); setReturnItemId(''); setReturnQty(''); setNotes(''); setReason('other');
      qc.invalidateQueries({ queryKey: ['pharmacy-returns'] });
      qc.invalidateQueries({ queryKey: ['pharmacy-sales'] });
      qc.invalidateQueries({ queryKey: ['pharmacy', 'dispensing-history'] });
      setTimeout(() => setReturnSub('history'), 1200);
    },
    onError: (e: any) => {
      setFormMsg({ type: 'err', text: e?.response?.data?.message ?? 'Failed to record return.' });
    },
  });

  const posSales = (sales as any[])
    .map((s: any) => ({ ...s, _type: 'pos' as const }))
    .filter((s: any) => s.status !== 'voided');

  const dispensedSales = (dispensed as any[]).map((d: any) => {
    const patient = d.visit?.patient;
    const customerName = patient
      ? `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim()
      : d.visit?.patientName ?? 'Patient';
    const unitPrice = Number(d.medicine?.sellPrice ?? 0);
    const quantity = Number(d.quantity ?? 0);
    const totalAmount = unitPrice * quantity;
    return {
      id: d.id,
      saleNumber: `RX-${d.id.slice(0, 6).toUpperCase()}`,
      customerName,
      paymentMethod: 'prescription',
      totalAmount,
      subtotalAmount: totalAmount,
      discountAmount: 0, taxAmount: 0, paidAmount: 0,
      status: 'dispensed',
      createdAt: d.dispensedAt ?? d.createdAt,
      items: d.medicine ? [{
        id: d.id,
        medicine: { name: d.drugName ?? d.medicine?.name },
        quantity,
        unitPrice,
        subtotal: totalAmount,
      }] : [],
      _type: 'dispensing' as const,
      cashierName: d.dispensedByName ?? '—',
    };
  });

  const completedSales = [...posSales, ...dispensedSales].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Payment breakdown
  const paymentTotals = (sales as any[]).reduce((acc: any, s: any) => {
    if (s.status === 'voided') return acc;
    const pm = s.paymentMethod ?? 'cash';
    acc[pm] = (acc[pm] ?? 0) + Number(s.totalAmount);
    return acc;
  }, {} as Record<string, number>);

  const grandTotal = Object.values(paymentTotals).reduce((a: number, b) => a + (b as number), 0);

  const PM_LABELS: Record<string, string> = {
    cash: 'Cash', zaad: 'ZAAD', edahab: 'E-DAHAB',
    bank_transfer: 'Bank Transfer', card: 'Card', mobile: 'Mobile', credit: 'Credit',
  };

  const filteredSales = completedSales.filter((s: any) => {
    if (search && !s.saleNumber?.toLowerCase().includes(search.toLowerCase()) &&
        !s.customerName?.toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter === 'pos' && s._type !== 'pos') return false;
    if (typeFilter === 'dispensing' && s._type !== 'dispensing') return false;
    if (dateFrom && new Date(s.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const returnedQtyByItem = (returns as any[]).reduce((acc: Record<string, number>, r: any) => {
    const key = r.saleItemId ?? r.prescriptionId;
    if (!key) return acc;
    acc[key] = (acc[key] ?? 0) + Number(r.quantity ?? 0);
    return acc;
  }, {} as Record<string, number>);

  const returnableItems = (returnTarget?.items ?? []).map((it: any) => {
    const alreadyReturned = returnedQtyByItem[it.id] ?? 0;
    return { ...it, remaining: Number(it.quantity) - alreadyReturned };
  });

  const selectedReturnItem = returnableItems.find((it: any) => it.id === returnItemId) ?? null;

  const tabCls = (t: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === t
        ? 'border-primary-600 text-primary-600'
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  const subCls = (t: ReturnSubTab) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      returnSub === t ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
    }`;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/pharmacy/pos')} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 size={24} className="text-primary-600" /> Pharmacy Reports
          </h1>
          <p className="text-sm text-gray-500">Sales, returns and payment breakdowns.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 flex gap-1">
        <button className={tabCls('sales')} onClick={() => setTab('sales')}>
          <ShoppingCart size={14} className="inline mr-1" />Sales
        </button>
        <button className={tabCls('returns')} onClick={() => setTab('returns')}>
          <RefreshCw size={14} className="inline mr-1" />Returns
        </button>
        <button className={tabCls('payments')} onClick={() => setTab('payments')}>
          <CreditCard size={14} className="inline mr-1" />Payments
        </button>
      </div>

      {/* ── SALES TAB ── */}
      {tab === 'sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total Sales</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{filteredSales.length}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Revenue</p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {fmt(filteredSales.reduce((a: number, s: any) => a + Number(s.totalAmount), 0))}
              </p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Returns</p>
              <p className="text-2xl font-bold text-red-500 mt-1">{(returns as any[]).length}</p>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-lg border overflow-hidden text-sm">
              {(['all', 'pos', 'dispensing'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTypeFilter(t)}
                  className={`px-3 py-1.5 font-medium capitalize transition-colors ${typeFilter === t ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:text-gray-700'}`}
                >
                  {t === 'all' ? 'All' : t === 'pos' ? 'POS' : 'Dispensing'}
                </button>
              ))}
            </div>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm text-gray-600" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm text-gray-600" />
            {(dateFrom || dateTo || typeFilter !== 'all') && (
              <button onClick={() => { setDateFrom(''); setDateTo(''); setTypeFilter('all'); }}
                className="text-xs text-red-500 hover:underline">Clear filters</button>
            )}
          </div>

          <div className="bg-white rounded-xl border">
            <div className="p-4 border-b flex items-center gap-2">
              <Search size={16} className="text-gray-400" />
              <input
                className="flex-1 text-sm outline-none"
                placeholder="Search by sale number or customer…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {salesLoading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-600" /></div>
            ) : filteredSales.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No sales found.</p>
            ) : (
              <div className="divide-y">
                {filteredSales.map((s: any) => (
                  <div key={s.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left cursor-pointer"
                      onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setExpanded(expanded === s.id ? null : s.id); }}
                    >
                      <div>
                        <span className="font-mono text-sm font-semibold text-primary-700">{s.saleNumber}</span>
                        <span className="ml-3 text-sm text-gray-500">{s.customerName ?? 'Walk-in'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-green-700">{fmt(s.totalAmount)}</span>
                        <span className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString()}</span>
                        {(s.items?.length ?? 0) > 0 && (
                          <button
                            title="Record a return for this transaction"
                            onClick={e => {
                              e.stopPropagation();
                              setReturnTarget(s);
                              setReturnItemId('');
                              setReturnQty('');
                              setTab('returns');
                              setReturnSub('new');
                              setFormMsg(null);
                            }}
                            className="flex items-center gap-1 text-xs text-orange-500 hover:text-orange-700 font-medium px-2 py-1 rounded hover:bg-orange-50"
                          >
                            <CornerDownLeft size={12} /> Return
                          </button>
                        )}
                        {expanded === s.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>
                    {expanded === s.id && (
                      <div className="px-4 pb-4 bg-gray-50 text-sm space-y-2">
                        <div className="grid grid-cols-3 gap-2 text-gray-600">
                          <span>Payment: <strong>{PM_LABELS[s.paymentMethod] ?? s.paymentMethod}</strong></span>
                          <span>Cashier: <strong>{s.cashierName ?? '—'}</strong></span>
                          <span>VAT: <strong>{fmt(s.taxAmount)}</strong></span>
                        </div>
                        <table className="w-full text-xs mt-2">
                          <thead><tr className="text-gray-400"><th className="text-left">Medicine</th><th>Qty</th><th>Unit</th><th>Subtotal</th></tr></thead>
                          <tbody>
                            {s.items?.map((it: any) => (
                              <tr key={it.id} className="border-t">
                                <td className="py-1">{it.medicine?.name ?? it.medicineId}</td>
                                <td className="text-center">{it.quantity}</td>
                                <td className="text-center">{fmt(it.unitPrice)}</td>
                                <td className="text-center">{fmt(it.subtotal)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── RETURNS TAB ── */}
      {tab === 'returns' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button className={subCls('new')} onClick={() => { setReturnSub('new'); setFormMsg(null); }}>New Return</button>
            <button className={subCls('history')} onClick={() => setReturnSub('history')}>Return History</button>
          </div>

          {returnSub === 'new' && (
            <div className="bg-white rounded-xl border p-6 max-w-lg space-y-4">
              <h2 className="font-semibold text-gray-800">Record a Sale Return</h2>

              {formMsg && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${formMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {formMsg.type === 'ok' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {formMsg.text}
                </div>
              )}

              {!returnTarget ? (
                <p className="text-sm text-gray-500">
                  Click the <strong>Return</strong> button next to a transaction in the Sales tab to start a return.
                </p>
              ) : (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Transaction</label>
                    <div className="w-full border rounded-lg px-3 py-2 text-sm bg-gray-50 flex items-center justify-between">
                      <span className="font-mono">{returnTarget.saleNumber}</span>
                      <span className="text-xs uppercase text-gray-400">{returnTarget._type === 'dispensing' ? 'RX' : 'POS'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Item to return</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={returnItemId}
                      onChange={e => { setReturnItemId(e.target.value); setReturnQty(''); }}
                    >
                      <option value="">Select an item…</option>
                      {returnableItems.map((it: any) => (
                        <option key={it.id} value={it.id} disabled={it.remaining <= 0}>
                          {(it.medicine?.name ?? 'Item')} — {it.remaining} of {it.quantity} returnable
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedReturnItem && (
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">
                        Quantity to return (max {selectedReturnItem.remaining})
                      </label>
                      <input
                        type="number" min="1" max={selectedReturnItem.remaining} step="1"
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="0"
                        value={returnQty}
                        onChange={e => setReturnQty(e.target.value)}
                      />
                      {Number(returnQty) > selectedReturnItem.remaining && (
                        <p className="text-xs text-red-500">Cannot exceed {selectedReturnItem.remaining} remaining unit(s).</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-gray-600">Reason</label>
                    <select
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={reason}
                      onChange={e => setReason(e.target.value)}
                    >
                      {Object.entries(REASON_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Notes (optional)</label>
                <textarea
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                  rows={3}
                  placeholder="Additional details…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>

              <button
                disabled={
                  !returnTarget || !returnItemId || !returnQty ||
                  Number(returnQty) <= 0 ||
                  (selectedReturnItem && Number(returnQty) > selectedReturnItem.remaining) ||
                  returnMut.isPending
                }
                onClick={() => { setFormMsg(null); returnMut.mutate(); }}
                className="w-full bg-primary-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {returnMut.isPending && <Loader2 size={14} className="animate-spin" />}
                Submit Return
              </button>
            </div>
          )}

          {returnSub === 'history' && (
            <div className="bg-white rounded-xl border">
              {returnsLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary-600" /></div>
              ) : (returns as any[]).length === 0 ? (
                <p className="text-center text-gray-400 py-10 text-sm">No returns recorded yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-4 py-3">Return #</th>
                      <th className="text-left px-4 py-3">Sale #</th>
                      <th className="text-left px-4 py-3">Reason</th>
                      <th className="px-4 py-3">Refund</th>
                      <th className="px-4 py-3">Processed By</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(returns as any[]).map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono text-primary-700">{r.returnNumber}</td>
                        <td className="px-4 py-3 font-mono text-gray-600">{r.type === 'rx' ? (r.medicine?.name ?? 'RX') : (r.sale?.saleNumber ?? r.saleId)}</td>
                        <td className="px-4 py-3">{REASON_LABELS[r.reason] ?? r.reason}</td>
                        <td className="px-4 py-3 text-center text-red-600 font-semibold">{fmt(r.refundAmount)}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{r.processedBy ?? '—'}</td>
                        <td className="px-4 py-3 text-center text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Payment Method Breakdown</h2>
            <div className="space-y-3">
              {Object.entries(paymentTotals).map(([pm, total]) => (
                <div key={pm} className="flex items-center gap-3">
                  <span className="w-32 text-sm text-gray-600">{PM_LABELS[pm] ?? pm}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-primary-500 h-3 rounded-full"
                      style={{ width: grandTotal ? `${((total as number) / grandTotal) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="w-24 text-right text-sm font-semibold text-gray-800">{fmt(total as number)}</span>
                  <span className="w-12 text-right text-xs text-gray-400">
                    {grandTotal ? `${(((total as number) / grandTotal) * 100).toFixed(1)}%` : '—'}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t flex justify-between">
              <span className="font-semibold text-gray-700">Total Revenue</span>
              <span className="font-bold text-green-600 text-lg">{fmt(grandTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
