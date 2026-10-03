import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Truck, Plus, Search, Eye, Printer, MoreVertical,
  CheckCircle2, XCircle, Trash2, FileText, DollarSign, CreditCard, Clock, Download,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { pharmacyApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

const PHARMACY_INFO = {
  name: 'AL-HIJRA PHARMACY',
  addressLine1: 'October, Hargeisa, Somaliland',
  phone: '+252 63 4734969',
  email: 'info@alhijrapharma.com',
};

interface Medicine {
  id: string;
  name: string;
  unit: string;
}

interface PurchaseItemRow {
  id: string;
  quantity: number;
  costPrice: number;
  subtotal: number;
  medicine: { name: string; unit: string };
}

interface PurchaseRow {
  id: string;
  purchaseNumber: string;
  supplierName: string;
  invoiceNumber?: string;
  attachmentUrl?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  approvalStatus: 'submitted' | 'admin_approved' | 'rejected' | 'paid';
  submittedByName?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  paidByName?: string;
  paidAt?: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  createdAt: string;
  confirmedAt?: string;
  items: PurchaseItemRow[];
}

type LineItem = { medicineId: string; quantity: string; costPrice: string };

const PAYMENT_BADGE: Record<string, string> = {
  paid: 'bg-green-100 text-green-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-red-100 text-red-600',
};

const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {
  submitted: { label: 'Awaiting Dept Head', cls: 'bg-blue-100 text-blue-700' },
  dept_head_approved: { label: 'Awaiting Admin Review', cls: 'bg-sky-100 text-sky-700' },
  dept_head_rejected: { label: 'Rejected by Dept Head', cls: 'bg-red-100 text-red-600' },
  admin_approved: { label: 'Approved · Awaiting Payment', cls: 'bg-indigo-100 text-indigo-700' },
  rejected: { label: 'Rejected by Admin', cls: 'bg-red-100 text-red-600' },
  paid: { label: 'Paid & Closed', cls: 'bg-green-100 text-green-700' },
};

const RECEIPT_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-clinical-100 text-clinical-500',
  cancelled: 'bg-gray-100 text-gray-400',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

function fmt(n: number | string) {
  return `$${Number(n).toFixed(2)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PurchasesPage() {
  const queryClient = useQueryClient();
  const { hasRole, user } = useAuthStore();
  const isAdmin = hasRole('administrator');
  const isAccountant = hasRole('accountant');

  // ----- filters -----
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [showMyQueue, setShowMyQueue] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // ----- create modal -----
  const [modalOpen, setModalOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [paidAmount, setPaidAmount] = useState('');

  // ----- detail / print / payment -----
  const [detail, setDetail] = useState<PurchaseRow | null>(null);
  const [printTarget, setPrintTarget] = useState<PurchaseRow | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<PurchaseRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const { data: purchases, isLoading } = useQuery({
    queryKey: ['pharmacy', 'purchases'],
    queryFn: async () => {
      const res = await pharmacyApi.getPurchases();
      return res.data as PurchaseRow[];
    },
  });

  const { data: deptQueue } = useQuery({
    queryKey: ['pharmacy', 'purchases', 'dept-head-queue'],
    queryFn: async () => {
      const res = await pharmacyApi.getDeptHeadQueue();
      return res.data as PurchaseRow[];
    },
  });
  const deptQueueIds = new Set((deptQueue ?? []).map((p) => p.id));

  const deptReviewMutation = useMutation({
    mutationFn: ({ id, decision, notes }: { id: string; decision: 'approve' | 'reject'; notes?: string }) =>
      pharmacyApi.deptHeadReviewPurchase(id, decision, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setOpenMenuId(null);
    },
  });

  const { data: medicines } = useQuery({
    queryKey: ['pharmacy', 'medicines', 'for-purchase'],
    queryFn: async () => {
      const res = await pharmacyApi.getMedicines();
      return res.data as Medicine[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      pharmacyApi.createPurchase({
        supplierName,
        invoiceNumber: invoiceNumber || undefined,
        attachmentUrl,
        paidAmount: Number(paidAmount) || 0,
        items: lines.map((l) => ({ medicineId: l.medicineId, quantity: Number(l.quantity), costPrice: Number(l.costPrice) })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      closeCreateModal();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.confirmPurchase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pharmacy'] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.cancelPurchase(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pharmacy'] }),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => pharmacyApi.recordPurchasePayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setPaymentTarget(null);
      setPaymentAmount('');
    },
  });

  const adminReviewMutation = useMutation({
    mutationFn: ({ id, decision, rejectionReason }: { id: string; decision: 'approve' | 'reject'; rejectionReason?: string }) =>
      pharmacyApi.adminReviewPurchase(id, decision, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setOpenMenuId(null);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.markPurchasePaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setOpenMenuId(null);
    },
  });

  // ----- derived data -----
  const all = purchases ?? [];

  const stats = useMemo(() => ({
    totalInvoices: all.length,
    totalAmount: all.reduce((s, p) => s + p.totalAmount, 0),
    paidAmount: all.reduce((s, p) => s + p.paidAmount, 0),
    dueAmount: all.reduce((s, p) => s + p.dueAmount, 0),
  }), [all]);

  const supplierOptions = useMemo(
    () => Array.from(new Set(all.map((p) => p.supplierName))).sort(),
    [all],
  );

  const filtered = useMemo(() => {
    return all.filter((p) => {
      if (showMyQueue && !deptQueueIds.has(p.id)) return false;
      if (search) {
        const q = search.toLowerCase();
        const matches =
          p.purchaseNumber.toLowerCase().includes(q) ||
          p.supplierName.toLowerCase().includes(q) ||
          (p.invoiceNumber ?? '').toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (supplierFilter !== 'all' && p.supplierName !== supplierFilter) return false;
      if (fromDate && new Date(p.createdAt) < new Date(fromDate)) return false;
      if (toDate && new Date(p.createdAt) > new Date(toDate + 'T23:59:59')) return false;
      return true;
    });
  }, [all, search, supplierFilter, fromDate, toDate, showMyQueue, deptQueueIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);

  function resetPage() {
    setPage(1);
  }

  // ----- create modal helpers -----
  function addLine() {
    if (!medicines || medicines.length === 0) return;
    setLines((prev) => [...prev, { medicineId: medicines[0].id, quantity: '', costPrice: '' }]);
  }
  function updateLine(index: number, patch: Partial<LineItem>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }
  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }
  function handleAttachmentFile(file: File | null | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAttachmentUrl((reader.result as string) || '');
    reader.readAsDataURL(file);
  }
  function closeCreateModal() {
    setModalOpen(false);
    setSupplierName('');
    setInvoiceNumber('');
    setAttachmentUrl('');
    setLines([]);
    setPaidAmount('');
  }
  const canSubmit = !!supplierName && !!attachmentUrl && lines.length > 0 && lines.every((l) => l.medicineId && l.quantity && l.costPrice);

  // ----- export -----
  function exportCsv() {
    const header = ['Invoice No', 'Supplier', 'Invoice Date', 'Total Amount', 'Paid Amount', 'Due Amount', 'Status'];
    const rows = filtered.map((p) => [
      p.purchaseNumber, p.supplierName, fmtDate(p.createdAt),
      p.totalAmount.toFixed(2), p.paidAmount.toFixed(2), p.dueAmount.toFixed(2), p.paymentStatus,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchase-invoices-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6">
      {/* Print styles: only the invoice area is visible when printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .invoice-print-area, .invoice-print-area * { visibility: visible; }
          .invoice-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Purchase Invoices</h1>
          <p className="text-clinical-500 text-sm mt-1">View and manage all purchase invoices from suppliers.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold border border-clinical-200 text-clinical-600 hover:bg-clinical-50"
          >
            <Download size={15} /> Export
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700"
          >
            <Plus size={15} /> New Purchase
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <FileText size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{stats.totalInvoices}</p>
            <p className="text-xs text-clinical-400">Total Invoices · All time</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
            <DollarSign size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{fmt(stats.totalAmount)}</p>
            <p className="text-xs text-clinical-400">Total Amount · All time</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <CreditCard size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{fmt(stats.paidAmount)}</p>
            <p className="text-xs text-clinical-400">Paid Amount · All time</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{fmt(stats.dueAmount)}</p>
            <p className="text-xs text-clinical-400">Due Amount · All time</p>
          </div>
        </div>
      </div>

      {(isAdmin || user?.isDeptHead) && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { setShowMyQueue((v) => !v); resetPage(); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              showMyQueue
                ? 'bg-primary-600 text-white border-primary-600'
                : 'bg-white text-clinical-600 border-clinical-200 hover:bg-clinical-50'
            }`}
          >
            Awaiting My Review{deptQueueIds.size > 0 ? ` (${deptQueueIds.size})` : ''}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Search by invoice no or supplier…"
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
          />
        </div>
        <select
          value={supplierFilter}
          onChange={(e) => { setSupplierFilter(e.target.value); resetPage(); }}
          className="border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
        >
          <option value="all">All Suppliers</option>
          {supplierOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => { setFromDate(e.target.value); resetPage(); }}
          className="border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
        />
        <input
          type="date"
          value={toDate}
          onChange={(e) => { setToDate(e.target.value); resetPage(); }}
          className="border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-clinical-200 overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : paged.length === 0 ? (
          <p className="text-center text-clinical-400 text-sm py-16">No purchase invoices found</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-clinical-100 bg-clinical-50">
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Invoice No</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Invoice Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Total Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Paid Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Due Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Approval</th>
                  <th className="px-4 py-3 sticky right-0 bg-clinical-50" />
                </tr>
              </thead>
              <tbody className="divide-y divide-clinical-50">
                {paged.map((p) => (
                  <tr key={p.id} className="group hover:bg-clinical-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-clinical-800">{p.purchaseNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-clinical-800">{p.supplierName}</p>
                      {p.status === 'pending' && (
                        <span className="text-[10px] font-semibold text-amber-600 uppercase">Awaiting receipt</span>
                      )}
                      {p.status === 'cancelled' && (
                        <span className="text-[10px] font-semibold text-gray-400 uppercase">Cancelled</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-clinical-500 text-xs">{fmtDate(p.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-clinical-900">{fmt(p.totalAmount)}</td>
                    <td className="px-4 py-3 text-clinical-600">{fmt(p.paidAmount)}</td>
                    <td className="px-4 py-3 text-clinical-600">{fmt(p.dueAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${PAYMENT_BADGE[p.paymentStatus]}`}>
                        {p.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${APPROVAL_BADGE[p.approvalStatus]?.cls ?? 'bg-clinical-100 text-clinical-500'}`}>
                        {APPROVAL_BADGE[p.approvalStatus]?.label ?? p.approvalStatus}
                      </span>
                      {p.approvalStatus === 'rejected' && p.rejectionReason && (
                        <p className="text-[10px] text-red-500 mt-0.5 max-w-[160px] truncate" title={p.rejectionReason}>{p.rejectionReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end relative">
                        <button
                          onClick={() => setDetail(p)}
                          title="View"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setPrintTarget(p)}
                          title="Print"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            if (openMenuId === p.id) {
                              setOpenMenuId(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            const menuHeight = 220;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
                            setMenuPos({ top: Math.max(8, top), left: Math.min(rect.right - 192, window.innerWidth - 200) });
                            setOpenMenuId(p.id);
                          }}
                          title="More"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <MoreVertical size={15} />
                        </button>

                        {openMenuId === p.id && menuPos && createPortal(
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="fixed z-50 bg-white border border-clinical-200 rounded-lg shadow-lg py-1 w-48 text-left"
                              style={{ top: menuPos.top, left: menuPos.left }}
                            >
                              {(() => {
                                const actions: { label: string; icon: any; onClick: () => void; className: string }[] = [];
                                if (p.status === 'pending') {
                                  actions.push({
                                    label: 'Confirm Receipt', icon: CheckCircle2,
                                    onClick: () => { confirmMutation.mutate(p.id); setOpenMenuId(null); },
                                    className: 'text-green-700 hover:bg-green-50',
                                  });
                                  actions.push({
                                    label: 'Cancel Purchase', icon: XCircle,
                                    onClick: () => { cancelMutation.mutate(p.id); setOpenMenuId(null); },
                                    className: 'text-red-600 hover:bg-red-50',
                                  });
                                }
                                if (deptQueueIds.has(p.id)) {
                                  actions.push({
                                    label: 'Approve (Dept Head)', icon: CheckCircle2,
                                    onClick: () => { deptReviewMutation.mutate({ id: p.id, decision: 'approve' }); },
                                    className: 'text-green-700 hover:bg-green-50',
                                  });
                                  actions.push({
                                    label: 'Reject (Dept Head)', icon: XCircle,
                                    onClick: () => {
                                      const reason = window.prompt('Rejection reason (optional):') || undefined;
                                      deptReviewMutation.mutate({ id: p.id, decision: 'reject', notes: reason });
                                    },
                                    className: 'text-red-600 hover:bg-red-50',
                                  });
                                }
                                if (isAdmin && p.approvalStatus === 'dept_head_approved') {
                                  actions.push({
                                    label: 'Approve (Admin Review)', icon: CheckCircle2,
                                    onClick: () => { adminReviewMutation.mutate({ id: p.id, decision: 'approve' }); },
                                    className: 'text-green-700 hover:bg-green-50',
                                  });
                                  actions.push({
                                    label: 'Reject', icon: XCircle,
                                    onClick: () => {
                                      const reason = window.prompt('Rejection reason (optional):') || undefined;
                                      adminReviewMutation.mutate({ id: p.id, decision: 'reject', rejectionReason: reason });
                                    },
                                    className: 'text-red-600 hover:bg-red-50',
                                  });
                                }
                                if ((isAccountant || isAdmin) && p.approvalStatus === 'admin_approved' && p.dueAmount === 0) {
                                  actions.push({
                                    label: 'Mark Paid (Close Out)', icon: DollarSign,
                                    onClick: () => markPaidMutation.mutate(p.id),
                                    className: 'text-primary-600 hover:bg-primary-50',
                                  });
                                }
                                if ((isAdmin || isAccountant) && p.paymentStatus !== 'paid' && p.status !== 'cancelled') {
                                  actions.push({
                                    label: 'Record Payment', icon: CreditCard,
                                    onClick: () => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); },
                                    className: 'text-primary-600 hover:bg-primary-50',
                                  });
                                }

                                if (actions.length === 0) {
                                  let note = 'No actions available';
                                  if (p.approvalStatus === 'admin_approved' && p.dueAmount > 0) note = 'Settle balance to mark paid';
                                  if (p.status === 'pending' && p.paymentStatus === 'paid') note = 'Confirm receipt to close out';
                                  return <p className="px-3 py-2 text-[11px] text-clinical-400">{note}</p>;
                                }

                                return actions.map((a, i) => {
                                  const Icon = a.icon;
                                  return (
                                    <button
                                      key={i}
                                      onClick={a.onClick}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium ${a.className}`}
                                    >
                                      <Icon size={13} /> {a.label}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-clinical-100 text-xs text-clinical-500">
              <span>
                Showing {(pageSafe - 1) * pageSize + 1} to {Math.min(pageSafe * pageSize, filtered.length)} of {filtered.length} invoices
              </span>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <button
                    disabled={pageSafe === 1}
                    onClick={() => setPage(1)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-clinical-200 disabled:opacity-30"
                  >«</button>
                  <button
                    disabled={pageSafe === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-clinical-200 disabled:opacity-30"
                  >‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, pageSafe - 3), Math.max(0, pageSafe - 3) + 5)
                    .map((n) => (
                      <button
                        key={n}
                        onClick={() => setPage(n)}
                        className={`w-7 h-7 flex items-center justify-center rounded-md text-xs font-semibold ${
                          n === pageSafe ? 'bg-primary-600 text-white' : 'border border-clinical-200 text-clinical-600'
                        }`}
                      >{n}</button>
                    ))}
                  <button
                    disabled={pageSafe === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-clinical-200 disabled:opacity-30"
                  >›</button>
                  <button
                    disabled={pageSafe === totalPages}
                    onClick={() => setPage(totalPages)}
                    className="w-7 h-7 flex items-center justify-center rounded-md border border-clinical-200 disabled:opacity-30"
                  >»</button>
                </div>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); resetPage(); }}
                  className="border border-clinical-200 rounded-md px-2 py-1 text-xs"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ---------- Create Purchase Modal ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeCreateModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-clinical-900">New Purchase</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Supplier Name *</label>
                <input value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Invoice Number</label>
                <input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-clinical-600 mb-1">Order / Invoice Attachment *</label>
              <label className="flex items-center gap-2 border border-clinical-200 rounded-lg px-3 py-2 text-xs cursor-pointer hover:bg-clinical-50">
                <span className="truncate">{attachmentUrl ? 'File attached ✓' : 'Choose file…'}</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => handleAttachmentFile(e.target.files?.[0])}
                />
              </label>
              {!attachmentUrl && (
                <p className="text-[11px] text-amber-600 mt-1">Required — attach the supplier invoice or order document.</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-clinical-600">Items</label>
                <button onClick={addLine} className="text-xs font-semibold text-primary-600 hover:underline">+ Add line</button>
              </div>
              <div className="space-y-2">
                {lines.map((l, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={l.medicineId}
                      onChange={(e) => updateLine(i, { medicineId: e.target.value })}
                      className="flex-1 border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                    >
                      {(medicines ?? []).map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <input
                      type="number" min={1} placeholder="Qty" value={l.quantity}
                      onChange={(e) => updateLine(i, { quantity: e.target.value })}
                      className="w-20 border border-clinical-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-primary-500"
                    />
                    <input
                      type="number" min={0} step="0.01" placeholder="Cost price" value={l.costPrice}
                      onChange={(e) => updateLine(i, { costPrice: e.target.value })}
                      className="w-24 border border-clinical-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-primary-500"
                    />
                    <button onClick={() => removeLine(i)} className="text-clinical-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {lines.length === 0 && (
                  <p className="text-xs text-clinical-400 text-center py-4">No items yet — click "Add line".</p>
                )}
              </div>
            </div>

            {(() => {
              const lineTotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.costPrice) || 0), 0);
              const paid = Number(paidAmount) || 0;
              const balance = Math.max(0, lineTotal - paid);
              return (
                <div className="bg-clinical-50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-clinical-500">Invoice Total</span>
                    <span className="font-semibold text-clinical-900">{fmt(lineTotal)}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-clinical-600 mb-1">Paid Amount</label>
                    <input
                      type="number" min={0} max={lineTotal} step="0.01"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      placeholder="0.00"
                      className={inputClass}
                    />
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-clinical-200 pt-2">
                    <span className="text-clinical-600">Balance Due</span>
                    <span className={balance > 0 ? 'text-red-600' : 'text-green-600'}>{fmt(balance)}</span>
                  </div>
                </div>
              );
            })()}

            {createMutation.isError && (
              <p className="text-red-600 text-xs">Couldn't save this purchase. Check the form and try again.</p>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
              <button onClick={closeCreateModal} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!canSubmit || createMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving…' : 'Save Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Detail Modal ---------- */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-clinical-900">{detail.purchaseNumber}</h2>
                <p className="text-xs text-clinical-400 mt-0.5">{detail.supplierName}{detail.invoiceNumber ? ` · Invoice ${detail.invoiceNumber}` : ''}</p>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${PAYMENT_BADGE[detail.paymentStatus]}`}>
                {detail.paymentStatus}
              </span>
            </div>

            <div className="space-y-1">
              {(detail.items ?? []).map((it) => (
                <div key={it.id} className="flex justify-between text-sm py-1.5 border-b border-clinical-50 last:border-0">
                  <span className="text-clinical-700">{it.quantity} × {it.medicine?.name ?? 'Unknown item'}</span>
                  <span className="font-medium text-clinical-800">{fmt(it.subtotal)}</span>
                </div>
              ))}
            </div>

            <div className="bg-clinical-50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-clinical-500">Total</span><span className="font-semibold">{fmt(detail.totalAmount)}</span></div>
              <div className="flex justify-between"><span className="text-clinical-500">Paid</span><span>{fmt(detail.paidAmount)}</span></div>
              <div className="flex justify-between"><span className="text-clinical-500">Due</span><span className="font-semibold text-red-600">{fmt(detail.dueAmount)}</span></div>
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setDetail(null)} className="px-4 py-2 rounded-lg text-sm font-semibold border border-clinical-200 text-clinical-600 hover:border-clinical-300">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Record Payment Modal ---------- */}
      {paymentTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPaymentTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-clinical-900">Record Payment</h2>
            <p className="text-xs text-clinical-500">
              {paymentTarget.purchaseNumber} · Due {fmt(paymentTarget.dueAmount)}
            </p>
            <input
              type="number" min={0.01} max={paymentTarget.dueAmount} step="0.01"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Amount"
              autoFocus
              className={inputClass}
            />
            {paymentMutation.isError && (
              <p className="text-red-600 text-xs">
                {(paymentMutation.error as any)?.response?.data?.message ?? "Couldn't record this payment."}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
              <button onClick={() => setPaymentTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => paymentAmount && paymentMutation.mutate({ id: paymentTarget.id, amount: Number(paymentAmount) })}
                disabled={!paymentAmount || paymentMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {paymentMutation.isPending ? 'Saving…' : 'Save Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Print Invoice Modal (Purchase Order layout) ---------- */}
      {printTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setPrintTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-0 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="invoice-print-area p-8">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-clinical-200 pb-4 mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-red-600 text-white flex items-center justify-center font-bold flex-shrink-0">Rx</div>
                  <div>
                    <p className="text-lg font-extrabold text-red-600 leading-tight">{PHARMACY_INFO.name}</p>
                    <p className="text-[11px] text-clinical-400">{PHARMACY_INFO.addressLine1}</p>
                    <p className="text-[11px] text-clinical-400">Tel: {PHARMACY_INFO.phone} · Email: {PHARMACY_INFO.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-extrabold text-clinical-900 tracking-wide">PURCHASE INVOICE</h2>
                  <p className="text-xs text-clinical-500 mt-1">PO No: <span className="font-semibold text-clinical-800">{printTarget.purchaseNumber}</span></p>
                  <p className="text-xs text-clinical-500">Date: {fmtDate(printTarget.createdAt)}</p>
                  {printTarget.confirmedAt && <p className="text-xs text-clinical-500">Received: {fmtDate(printTarget.confirmedAt)}</p>}
                </div>
              </div>

              {/* Supplier / Ship To */}
              <div className="grid grid-cols-2 gap-4 mb-5">
                <div className="border border-clinical-200 rounded-lg p-3">
                  <p className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-1.5">Supplier Details</p>
                  <p className="font-semibold text-clinical-900 text-sm">{printTarget.supplierName}</p>
                  {printTarget.invoiceNumber && <p className="text-xs text-clinical-500 mt-0.5">Invoice #: {printTarget.invoiceNumber}</p>}
                </div>
                <div className="border border-clinical-200 rounded-lg p-3">
                  <p className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-1.5">Ship To</p>
                  <p className="font-semibold text-clinical-900 text-sm">{PHARMACY_INFO.name}</p>
                  <p className="text-xs text-clinical-500 mt-0.5">{PHARMACY_INFO.addressLine1}</p>
                  <p className="text-xs text-clinical-500">Tel: {PHARMACY_INFO.phone}</p>
                </div>
              </div>

              {/* Items */}
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="bg-clinical-900 text-white">
                    <th className="text-left py-2 px-2 rounded-l">No.</th>
                    <th className="text-left py-2 px-2">Item</th>
                    <th className="text-right py-2 px-2">Unit</th>
                    <th className="text-right py-2 px-2">Qty</th>
                    <th className="text-right py-2 px-2">Unit Price</th>
                    <th className="text-right py-2 px-2 rounded-r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(printTarget.items ?? []).map((it, i) => (
                    <tr key={it.id} className="border-b border-clinical-100">
                      <td className="py-2 px-2">{i + 1}</td>
                      <td className="py-2 px-2 font-medium text-clinical-800">{it.medicine?.name ?? 'Unknown item'}</td>
                      <td className="py-2 px-2 text-right text-clinical-500">{it.medicine?.unit ?? ''}</td>
                      <td className="py-2 px-2 text-right">{it.quantity}</td>
                      <td className="py-2 px-2 text-right">{fmt(Number(it.costPrice))}</td>
                      <td className="py-2 px-2 text-right font-semibold">{fmt(Number(it.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Terms + Totals */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-1.5">Terms & Conditions</p>
                  <ul className="text-[11px] text-clinical-500 space-y-0.5 list-disc list-inside">
                    <li>Goods received and inspected on delivery.</li>
                    <li>Payment as per agreed supplier terms.</li>
                    <li>All items must be within valid expiry range.</li>
                  </ul>
                </div>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-clinical-500">Sub Total</span><span>{fmt(printTarget.totalAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-clinical-500">Discount</span><span>{fmt(0)}</span></div>
                  <div className="flex justify-between"><span className="text-clinical-500">VAT</span><span>{fmt(0)}</span></div>
                  <div className="flex justify-between font-bold text-clinical-900 pt-1 border-t border-clinical-200"><span>TOTAL</span><span>{fmt(printTarget.totalAmount)}</span></div>
                  <div className="flex justify-between text-clinical-600"><span>Paid</span><span>{fmt(printTarget.paidAmount)}</span></div>
                  <div className="flex justify-between font-bold text-red-600"><span>Balance Due</span><span>{fmt(printTarget.dueAmount)}</span></div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 mt-8 pt-4 border-t border-clinical-100 text-xs">
                <div>
                  <p className="font-semibold text-clinical-700">Prepared By:</p>
                  <p className="text-clinical-500 mt-1">Name: ____________________</p>
                  <p className="text-clinical-500">Signature: ________________</p>
                  <p className="text-clinical-500">Date: ____________________</p>
                </div>
                <div>
                  <p className="font-semibold text-clinical-700">Approved By:</p>
                  <p className="text-clinical-500 mt-1">Name: ____________________</p>
                  <p className="text-clinical-500">Signature: ________________</p>
                  <p className="text-clinical-500">Date: ____________________</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-clinical-100 print:hidden">
              <button onClick={() => setPrintTarget(null)} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90"
              >
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
