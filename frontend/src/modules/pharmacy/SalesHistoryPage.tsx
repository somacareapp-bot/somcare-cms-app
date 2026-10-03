import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, History, Search, Eye, XCircle, ShoppingCart,
  Pill, TrendingUp, DollarSign, ChevronDown, ChevronUp,
} from 'lucide-react';
import { pharmacyApi } from '../../services/api';

const VAT_RATE = 0.05;

function fmt(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

function badge(type: 'pos' | 'dispensing', status?: string) {
  if (status === 'voided') return 'bg-red-100 text-red-700';
  if (type === 'pos') return 'bg-blue-100 text-blue-700';
  return 'bg-green-100 text-green-700';
}

export function SalesHistoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pos' | 'dispensing'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [voidTarget, setVoidTarget] = useState<string | null>(null);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ['pharmacy', 'sales'],
    queryFn: async () => {
      const res = await pharmacyApi.getSales();
      return res.data as any[];
    },
  });

  const { data: dispensed = [], isLoading: loadingDispensed } = useQuery({
    queryKey: ['pharmacy', 'dispensing-history'],
    queryFn: async () => {
      const res = await pharmacyApi.getPrescriptions?.();
      const all = res?.data ?? [];
      // Only dispensed ones
      return all.filter((p: any) => p.status === 'dispensed');
    },
    enabled: typeof pharmacyApi.getPrescriptions === 'function',
  });

  const voidMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.voidSale(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy', 'sales'] });
      setVoidTarget(null);
    },
  });

  // Merge POS sales + dispensed prescriptions into one list
  const posSales = sales.map((s: any) => ({ ...s, _type: 'pos' as const }));
  const dispensedSales = dispensed.map((d: any) => ({
    id: d.id,
    saleNumber: d.prescriptionNumber ?? `RX-${d.id.slice(0, 6).toUpperCase()}`,
    customerName: d.patient ? `${d.patient.firstName} ${d.patient.lastName}` : 'Patient',
    customerPhone: d.patient?.phone ?? '—',
    paymentMethod: 'prescription',
    totalAmount: d.items?.reduce((sum: number, i: any) => sum + Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0), 0) ?? 0,
    subtotalAmount: d.items?.reduce((sum: number, i: any) => sum + Number(i.unitPrice ?? 0) * Number(i.quantity ?? 0), 0) ?? 0,
    discountAmount: 0,
    taxAmount: 0,
    paidAmount: 0,
    changeAmount: 0,
    status: 'dispensed',
    createdAt: d.dispensedAt ?? d.updatedAt ?? d.createdAt,
    items: d.items ?? [],
    _type: 'dispensing' as const,
  }));

  const all = [...posSales, ...dispensedSales].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = all.filter((s) => {
    if (typeFilter !== 'all' && s._type !== typeFilter) return false;
    const q = search.toLowerCase();
    if (q && !s.saleNumber?.toLowerCase().includes(q) && !s.customerName?.toLowerCase().includes(q)) return false;
    if (dateFrom && new Date(s.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(s.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const totalRevenue = filtered
    .filter((s) => s.status !== 'voided')
    .reduce((sum, s) => sum + Number(s.totalAmount ?? 0), 0);
  const posCount = filtered.filter((s) => s._type === 'pos' && s.status !== 'voided').length;
  const dispCount = filtered.filter((s) => s._type === 'dispensing').length;

  const inputClass = 'border border-clinical-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
          <History size={22} className="text-primary-600" /> Sales History
        </h1>
        <p className="text-clinical-500 text-sm mt-1">Track all POS sales and dispensed prescription sales.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center">
            <DollarSign size={18} className="text-primary-600" />
          </div>
          <div>
            <p className="text-xs text-clinical-400 font-medium">Total Revenue</p>
            <p className="text-xl font-bold text-clinical-900">{fmt(totalRevenue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
            <ShoppingCart size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-clinical-400 font-medium">POS Sales</p>
            <p className="text-xl font-bold text-clinical-900">{posCount}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
            <Pill size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-clinical-400 font-medium">Dispensed Rx</p>
            <p className="text-xl font-bold text-clinical-900">{dispCount}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-clinical-200 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by sale # or customer…"
              className={`${inputClass} pl-9 w-full`}
            />
          </div>
          <div className="flex gap-1 bg-clinical-50 rounded-lg p-1">
            {(['all', 'pos', 'dispensing'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                  typeFilter === t ? 'bg-white shadow text-primary-600' : 'text-clinical-500 hover:text-clinical-700'
                }`}
              >
                {t === 'all' ? 'All' : t === 'pos' ? 'POS Sales' : 'Dispensed Rx'}
              </button>
            ))}
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={inputClass} />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={inputClass} />
          {(dateFrom || dateTo || search || typeFilter !== 'all') && (
            <button
              onClick={() => { setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-clinical-400 hover:text-red-500 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        {isLoading || loadingDispensed ? (
          <div className="flex items-center justify-center py-20 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-clinical-400">
            <TrendingUp size={36} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No sales records found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-clinical-50 border-b border-clinical-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Sale #</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Customer</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Date & Time</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Payment</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Total</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Status</th>
                <th className="text-center px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-50">
              {filtered.map((s) => (
                <>
                  <tr key={s.id} className="hover:bg-clinical-50/50 transition-colors">
                    <td className="px-4 py-3 font-mono font-semibold text-primary-600 text-xs">{s.saleNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${badge(s._type, s.status)}`}>
                        {s._type === 'pos' ? <ShoppingCart size={10} /> : <Pill size={10} />}
                        {s._type === 'pos' ? 'POS' : 'Dispensed Rx'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-clinical-700">
                      <p className="font-medium">{s.customerName || 'Walk-in'}</p>
                      {s.customerPhone && s.customerPhone !== '—' && (
                        <p className="text-xs text-clinical-400">{s.customerPhone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-clinical-500 text-xs">
                      <p>{new Date(s.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</p>
                      <p>{new Date(s.createdAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-clinical-600 text-xs font-medium">{s.paymentMethod}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-clinical-900">{fmt(Number(s.totalAmount))}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                        s.status === 'voided' ? 'bg-red-100 text-red-700' :
                        s.status === 'dispensed' ? 'bg-green-100 text-green-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {s.status === 'voided' ? 'Voided' : s.status === 'dispensed' ? 'Dispensed' : 'Completed'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                          className="text-clinical-400 hover:text-primary-600 transition-colors"
                          title="View details"
                        >
                          {expanded === s.id ? <ChevronUp size={15} /> : <Eye size={15} />}
                        </button>
                        {s._type === 'pos' && s.status !== 'voided' && (
                          <button
                            onClick={() => setVoidTarget(s.id)}
                            className="text-clinical-400 hover:text-red-500 transition-colors"
                            title="Void sale"
                          >
                            <XCircle size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === s.id && (
                    <tr key={`${s.id}-detail`} className="bg-clinical-50/70">
                      <td colSpan={8} className="px-6 py-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {/* Items table */}
                          <div>
                            <p className="text-xs font-bold text-clinical-500 uppercase tracking-wide mb-2">Items</p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-clinical-200">
                                  <th className="text-left py-1 text-clinical-500">Medicine</th>
                                  <th className="text-right py-1 text-clinical-500">Qty</th>
                                  <th className="text-right py-1 text-clinical-500">Price</th>
                                  <th className="text-right py-1 text-clinical-500">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(s.items ?? []).map((it: any, i: number) => (
                                  <tr key={i} className="border-b border-clinical-100">
                                    <td className="py-1.5">{it.medicine?.name ?? it.medicineName ?? '—'}</td>
                                    <td className="py-1.5 text-right">{it.quantity}</td>
                                    <td className="py-1.5 text-right">{fmt(Number(it.unitPrice ?? 0))}</td>
                                    <td className="py-1.5 text-right font-semibold">{fmt(Number(it.subtotal ?? Number(it.unitPrice ?? 0) * Number(it.quantity ?? 0)))}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Totals */}
                          <div className="space-y-1 text-xs">
                            <p className="text-xs font-bold text-clinical-500 uppercase tracking-wide mb-2">Summary</p>
                            <div className="flex justify-between text-clinical-500"><span>Subtotal</span><span>{fmt(Number(s.subtotalAmount ?? s.totalAmount))}</span></div>
                            <div className="flex justify-between text-clinical-500"><span>Discount</span><span>-{fmt(Number(s.discountAmount ?? 0))}</span></div>
                            <div className="flex justify-between text-clinical-500"><span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span><span>{fmt(Number(s.taxAmount ?? 0))}</span></div>
                            <div className="flex justify-between font-bold text-clinical-900 pt-1 border-t border-clinical-200"><span>Total</span><span>{fmt(Number(s.totalAmount ?? 0))}</span></div>
                            {s._type === 'pos' && (
                              <>
                                <div className="flex justify-between text-clinical-500"><span>Paid</span><span>{fmt(Number(s.paidAmount ?? 0))}</span></div>
                                <div className="flex justify-between font-semibold text-green-700"><span>Change</span><span>{fmt(Number(s.changeAmount ?? 0))}</span></div>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Void confirm modal */}
      {voidTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle size={18} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-clinical-900">Void this sale?</p>
                <p className="text-xs text-clinical-500">This action cannot be undone. Stock will be restored.</p>
              </div>
            </div>
            {voidMutation.isError && (
              <p className="text-red-600 text-xs">{(voidMutation.error as any)?.response?.data?.message ?? 'Failed to void sale.'}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setVoidTarget(null)} className="px-4 py-2 rounded-lg text-sm border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => voidMutation.mutate(voidTarget)}
                disabled={voidMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {voidMutation.isPending ? 'Voiding…' : 'Yes, Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
