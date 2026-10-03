/**
 * ExpenseReceiptModal.tsx
 * Drop into: frontend/src/modules/billing/
 * (Already wired into ExpensesPage.tsx — just overwrite the file)
 */

import { useRef, useEffect, useState } from 'react';
import { X, Download, Printer, CheckCircle2, Clock, XCircle, DollarSign } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { expenseCategoriesApi } from '../../services/api';
import somcareLogo from '../../assets/somcare-logo.png';

// ─── Brand colours ────────────────────────────────────────────────────────────
// SomCare dark red
const BRAND       = '#9B1C1C';   // primary
const BRAND_DARK  = '#7F1D1D';   // gradient end / table header
const BRAND_LIGHT = '#FEF2F2';   // tinted backgrounds

// PDF RGB tuples
const PDF_BRAND      = [155, 28,  28] as [number, number, number];
const PDF_BRAND_DARK = [127, 29,  29] as [number, number, number];
const PDF_LIGHT      = [254, 242, 242] as [number, number, number];
const PDF_SLATE_HDR  = [ 51, 65,  85] as [number, number, number];
const PDF_GREY       = [100, 116, 139] as [number, number, number];

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseStatus =
  | 'pending'
  | 'dept_head_approved'
  | 'dept_head_rejected'
  | 'approved'
  | 'rejected'
  | 'paid';

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
  deptHeadAutoSkipped?: boolean;
  approvedByName?: string;
  approvedAt?: string;
  adminNotes?: string;
  paidByName?: string;
  paidAt?: string;
  paidNotes?: string;
  createdAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (v: string | number) =>
  `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const fmtDateTime = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

const receiptNumber = (id: string) => `EXP-${id.slice(-6).toUpperCase()}`;

const STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending:              'Pending Review',
  dept_head_approved:   'Dept Head Approved',
  dept_head_rejected:   'Dept Head Rejected',
  approved:             'Approved',
  rejected:             'Rejected',
  paid:                 'Paid',
};

const STATUS_COLOR: Record<ExpenseStatus, string> = {
  pending:            '#f59e0b',
  dept_head_approved: '#3b82f6',
  dept_head_rejected: '#ef4444',
  approved:           '#10b981',
  rejected:           '#ef4444',
  paid:               '#059669',
};

// ─── Timeline builder ─────────────────────────────────────────────────────────

interface TimelineStep {
  label: string;
  person?: string;
  time?: string;
  notes?: string;
  state: 'done' | 'rejected' | 'pending' | 'skipped';
}

function buildTimeline(e: Expense): TimelineStep[] {
  const steps: TimelineStep[] = [];

  steps.push({
    label: 'Submitted',
    person: e.submittedByName,
    time: fmtDateTime(e.createdAt),
    state: 'done',
  });

  if (e.deptHeadAutoSkipped) {
    steps.push({ label: 'Dept Head Review', notes: 'Auto-skipped (no dept head)', state: 'skipped' });
  } else if (e.status === 'dept_head_rejected') {
    steps.push({ label: 'Dept Head Review', person: e.deptHeadApprovedByName, time: fmtDateTime(e.deptHeadApprovedAt), notes: e.deptHeadNotes, state: 'rejected' });
  } else if (e.deptHeadApprovedByName) {
    steps.push({ label: 'Dept Head Approved', person: e.deptHeadApprovedByName, time: fmtDateTime(e.deptHeadApprovedAt), notes: e.deptHeadNotes, state: 'done' });
  } else if (e.status === 'pending') {
    steps.push({ label: 'Dept Head Review', state: 'pending' });
  }

  if (e.status === 'dept_head_rejected') {
    // not reached
  } else if (e.status === 'rejected' && e.approvedByName) {
    steps.push({ label: 'Admin Approval', person: e.approvedByName, time: fmtDateTime(e.approvedAt), notes: e.adminNotes, state: 'rejected' });
  } else if (e.approvedByName && e.approvedByName !== e.deptHeadApprovedByName) {
    steps.push({ label: 'Admin Approved', person: e.approvedByName, time: fmtDateTime(e.approvedAt), notes: e.adminNotes, state: 'done' });
  } else if (e.status === 'dept_head_approved') {
    steps.push({ label: 'Admin Approval', state: 'pending' });
  }

  if (e.status === 'paid' && e.paidByName) {
    steps.push({ label: 'Payment Processed', person: e.paidByName, time: fmtDateTime(e.paidAt), notes: e.paidNotes, state: 'done' });
  } else if (e.status === 'approved') {
    steps.push({ label: 'Payment', state: 'pending' });
  }

  return steps;
}

// ─── PDF generator ────────────────────────────────────────────────────────────

async function downloadPDF(expense: Expense, categoryLabel: string, logoSrc: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const isPaid = expense.status === 'paid';

  // ── Header bar (dark red gradient) ──
  doc.setFillColor(...PDF_BRAND);
  doc.rect(0, 0, W, 32, 'F');
  // subtle darker stripe at bottom of header
  doc.setFillColor(...PDF_BRAND_DARK);
  doc.rect(0, 28, W, 4, 'F');

  // ── Logo (PNG with transparency — loaded via Vite import) ──
  try {
    const img = new Image();
    img.src = logoSrc;
    await new Promise((res) => { img.onload = res; img.onerror = res; });
    if (img.naturalWidth > 0) {
      // Draw logo with no background so transparency is preserved
      doc.addImage(img, 'PNG', 10, 3, 38, 26);
    }
  } catch { /* logo is optional */ }

  // ── Header text ──
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('EXPENSE RECEIPT', W - 14, 13, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Receipt No: ${receiptNumber(expense.id)}`, W - 14, 20, { align: 'right' });
  doc.text(`Date: ${fmtDate(expense.date)}`, W - 14, 27, { align: 'right' });

  // ── Status badge ──
  const badgeRgb: [number,number,number] = isPaid
    ? [5, 150, 105]
    : expense.status === 'rejected' || expense.status === 'dept_head_rejected'
    ? [239, 68, 68]
    : [245, 158, 11];
  doc.setFillColor(...badgeRgb);
  doc.roundedRect(W - 50, 34, 40, 9, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(STATUS_LABEL[expense.status].toUpperCase(), W - 30, 40, { align: 'center' });

  // ── Submitted by ──
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Submitted by', 14, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_GREY);
  doc.text(expense.submittedByName, 14, 46);
  if (expense.createdAt) doc.text(fmtDateTime(expense.createdAt), 14, 51);

  // ── Expense details table ──
  autoTable(doc, {
    startY: 58,
    head: [['Description', 'Category', 'Date', 'Amount']],
    body: [[expense.description, categoryLabel, fmtDate(expense.date), fmt(expense.amount)]],
    headStyles: { fillColor: PDF_BRAND, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: PDF_LIGHT },
    columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
    margin: { left: 14, right: 14 },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;

  // ── Notes ──
  if (expense.notes) {
    doc.setFillColor(...PDF_LIGHT);
    doc.roundedRect(14, y, W - 28, 14, 2, 2, 'F');
    doc.setTextColor(...PDF_GREY);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes', 18, y + 5);
    doc.setFont('helvetica', 'normal');
    doc.text(expense.notes, 18, y + 10);
    y += 18;
  }

  // ── Total amount box ──
  doc.setFillColor(...PDF_BRAND);
  doc.roundedRect(W - 70, y, 56, 14, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('TOTAL AMOUNT', W - 42, y + 5, { align: 'center' });
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(fmt(expense.amount), W - 42, y + 12, { align: 'center' });
  y += 20;

  // ── PAID stamp ──
  if (isPaid) {
    doc.setTextColor(5, 150, 105);
    doc.setFontSize(42);
    doc.setFont('helvetica', 'bold');
    doc.text('PAID', W / 2, y + 16, { align: 'center' });
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...PDF_GREY);
    if (expense.paidAt)     doc.text(`Processed on ${fmtDateTime(expense.paidAt)}`, W / 2, y + 24, { align: 'center' });
    if (expense.paidByName) doc.text(`By ${expense.paidByName}`, W / 2, y + 30, { align: 'center' });
    y += 36;
  }

  // ── Approval timeline table ──
  const timeline = buildTimeline(expense);
  autoTable(doc, {
    startY: y + 4,
    head: [['Stage', 'Person', 'Date & Time', 'Notes']],
    body: timeline.map((s) => [
      s.label,
      s.person || (s.state === 'pending' ? 'Awaiting…' : s.state === 'skipped' ? 'N/A' : ''),
      s.time || '',
      s.notes || '',
    ]),
    headStyles: { fillColor: PDF_SLATE_HDR, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const step = timeline[data.row.index];
        if (step?.state === 'rejected') data.cell.styles.textColor = [239, 68, 68];
        if (step?.state === 'pending')  data.cell.styles.textColor = [156, 163, 175];
        if (step?.state === 'skipped')  data.cell.styles.textColor = [156, 163, 175];
      }
    },
  });

  // ── Footer ──
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFillColor(...PDF_BRAND_DARK);
  doc.rect(0, pageH - 12, W, 12, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('SomCare Clinical Management System  ·  Generated automatically', W / 2, pageH - 5, { align: 'center' });

  doc.save(`${receiptNumber(expense.id)}.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  expense: Expense | null;
  onClose: () => void;
}

export function ExpenseReceiptModal({ expense, onClose }: Props) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const [categoryLabel, setCategoryLabel] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!expense) return;
    setCategoryLabel('');
    expenseCategoriesApi
      .getAll?.()
      .then((r: any) => {
        const cats: { code: string; label: string }[] = r?.data ?? [];
        const found = cats.find((c) => c.code === expense.category);
        setCategoryLabel(found?.label ?? expense.category);
      })
      .catch(() => setCategoryLabel(expense.category));
  }, [expense?.id]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!expense) return null;

  const isPaid     = expense.status === 'paid';
  const isRejected = expense.status === 'rejected' || expense.status === 'dept_head_rejected';
  const timeline   = buildTimeline(expense);

  const handleDownload = async () => {
    setPdfLoading(true);
    try { await downloadPDF(expense, categoryLabel || expense.category, somcareLogo); }
    finally { setPdfLoading(false); }
  };

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <div
        className="relative flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '92vh' }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between rounded-t-2xl px-6 py-4"
          style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
        >
          <div>
            <p className="text-xs font-medium uppercase tracking-widest" style={{ color: '#fca5a5' }}>
              Expense Receipt
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-white">
              {receiptNumber(expense.id)}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <span
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ background: STATUS_COLOR[expense.status] }}
            >
              {STATUS_LABEL[expense.status].toUpperCase()}
            </span>

            <button
              onClick={() => window.print()}
              title="Print"
              className="rounded-lg p-2 transition hover:bg-white/10"
              style={{ color: '#fca5a5' }}
            >
              <Printer size={16} />
            </button>

            <button
              onClick={handleDownload}
              disabled={pdfLoading}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition disabled:opacity-60 hover:bg-white/20"
              style={{ background: 'rgba(255,255,255,0.15)' }}
            >
              <Download size={14} />
              {pdfLoading ? 'Generating…' : 'Download PDF'}
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-2 transition hover:bg-white/10"
              style={{ color: '#fca5a5' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-0 lg:grid-cols-5">

            {/* LEFT */}
            <div className="border-r border-slate-100 p-6 lg:col-span-3">

              {/* Submitted by */}
              <div className="mb-5 flex items-start gap-3">
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-bold text-sm text-white"
                  style={{ background: BRAND }}
                >
                  {expense.submittedByName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Submitted by</p>
                  <p className="font-semibold text-slate-800">{expense.submittedByName}</p>
                  {expense.createdAt && (
                    <p className="text-xs text-slate-400">{fmtDateTime(expense.createdAt)}</p>
                  )}
                </div>
              </div>

              {/* Details card */}
              <div className="rounded-xl border border-slate-100 p-4 mb-4" style={{ background: BRAND_LIGHT }}>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Expense Details
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-400">Date</p>
                    <p className="font-medium text-slate-800">{fmtDate(expense.date)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Category</p>
                    <p className="font-medium text-slate-800">{categoryLabel || expense.category}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-400">Description</p>
                    <p className="font-medium text-slate-800">{expense.description}</p>
                  </div>
                  {expense.notes && (
                    <div className="col-span-2">
                      <p className="text-xs text-slate-400">Notes</p>
                      <p className="text-slate-600">{expense.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Amount */}
              <div
                className="flex items-center justify-between rounded-xl px-5 py-4"
                style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
              >
                <div className="flex items-center gap-2 text-white/80">
                  <DollarSign size={20} />
                  <span className="font-medium">Total Amount</span>
                </div>
                <span className="text-2xl font-bold text-white">{fmt(expense.amount)}</span>
              </div>

              {/* PAID stamp */}
              {isPaid && (
                <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-emerald-500 py-4">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                  <span className="text-2xl font-extrabold tracking-widest text-emerald-600">PAID</span>
                  {expense.paidAt     && <span className="text-xs text-slate-400">{fmtDateTime(expense.paidAt)}</span>}
                  {expense.paidByName && <span className="text-xs text-slate-400">By {expense.paidByName}</span>}
                </div>
              )}

              {/* REJECTED stamp */}
              {isRejected && (
                <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-red-400 py-4">
                  <XCircle size={28} className="text-red-400" />
                  <span className="text-2xl font-extrabold tracking-widest text-red-500">REJECTED</span>
                </div>
              )}

              {/* Attached file */}
              {expense.receiptUrl && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Attached Receipt
                  </p>
                  {expense.receiptUrl.startsWith('data:image') ? (
                    <a href={expense.receiptUrl} target="_blank" rel="noreferrer">
                      <img src={expense.receiptUrl} alt="Receipt"
                        className="max-h-48 w-full rounded-lg object-contain border border-slate-200" />
                    </a>
                  ) : (
                    <a href={expense.receiptUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition"
                      style={{ borderColor: '#fca5a5', background: BRAND_LIGHT, color: BRAND }}
                    >
                      <Download size={14} />
                      View attached file
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT — Timeline */}
            <div className="p-6 lg:col-span-2">
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Approval Timeline
              </p>

              <ol className="relative border-l border-slate-200 pl-5 space-y-5">
                {timeline.map((step, i) => {
                  const icon =
                    step.state === 'done'     ? <CheckCircle2 size={16} className="text-emerald-500" /> :
                    step.state === 'rejected' ? <XCircle      size={16} className="text-red-400"     /> :
                    step.state === 'skipped'  ? <span className="text-slate-300 text-xs font-bold">—</span> :
                                                <Clock        size={16} className="text-amber-400"   />;

                  return (
                    <li key={i} className="relative">
                      <span className="absolute -left-[27px] flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-slate-100">
                        {icon}
                      </span>
                      <div className={`rounded-lg p-3 ${
                        step.state === 'done'     ? 'bg-emerald-50 border border-emerald-100' :
                        step.state === 'rejected' ? 'bg-red-50 border border-red-100'         :
                        step.state === 'pending'  ? 'bg-amber-50 border border-amber-100'     :
                                                    'bg-slate-50 border border-slate-100'
                      }`}>
                        <p className={`text-sm font-semibold ${
                          step.state === 'done'     ? 'text-emerald-800' :
                          step.state === 'rejected' ? 'text-red-700'     :
                          step.state === 'pending'  ? 'text-amber-700'   :
                                                      'text-slate-400'
                        }`}>{step.label}</p>
                        {step.person && <p className="mt-0.5 text-xs text-slate-500">{step.person}</p>}
                        {step.time   && <p className="text-xs text-slate-400">{step.time}</p>}
                        {step.notes  && (
                          <p className="mt-1.5 rounded bg-white/70 px-2 py-1 text-xs text-slate-500 italic">
                            "{step.notes}"
                          </p>
                        )}
                        {step.state === 'pending' && <p className="mt-0.5 text-xs text-amber-500">Awaiting action…</p>}
                        {step.state === 'skipped' && <p className="mt-0.5 text-xs text-slate-400">{step.notes}</p>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-between rounded-b-2xl border-t border-slate-100 bg-slate-50 px-6 py-3">
          <p className="text-xs text-slate-400">
            SomCare Clinical Management System · {receiptNumber(expense.id)}
          </p>
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
