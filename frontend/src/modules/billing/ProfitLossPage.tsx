import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BarChart3,
  Printer,
  Download,
  Landmark,
  Receipt,
  TrendingUp,
  Settings2,
  ChevronDown,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { reportsApi, departmentsApi } from '../../services/api';

// ---------------------------------------------------------------------------
// Types — matches the real backend response from reportsApi.getProfitLoss
// ---------------------------------------------------------------------------

interface ProfitLossResponse {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  paymentsCount: number;
  approvedExpensesCount: number;
  byDay: { date: string; income: number; expenses: number }[];
  byPaymentMethod: { method: string; amount: number }[];
  byCategory: { category: string; amount: number }[];
  byRevenueCategory: { category: string; amount: number }[];
  totalRevenueFromInvoices?: number;
}

interface LineItem {
  label: string;
  amount: number;
}

interface TemplateItem {
  label: string;
  keywords: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const fmt = (n: number | string) =>
  Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sum = (items: LineItem[]) => items.reduce((t, i) => t + i.amount, 0);
const pct = (n: number, total: number) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}
function displayDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}
function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Backend returns a flat expense-by-category list. The design splits expenses
// into "Cost of Sales" (direct clinical costs) vs "Operating Expenses"
// (overheads). There's no such split in the API yet, so this keyword match
// classifies categories client-side — adjust the keyword list to match your
// real category names if this misclassifies anything.
const COST_OF_SALES_KEYWORDS = ['medicine', 'drug', 'pharmac', 'lab', 'consumable'];
function isCostOfSales(category: string) {
  const c = category.toLowerCase();
  return COST_OF_SALES_KEYWORDS.some((k) => c.includes(k));
}

// Each section always shows this full set of line items — even when a line
// has no matching data for the period, it's shown at $0.00 rather than
// hidden. Real data is matched onto a template row by keyword; anything
// that doesn't match any keyword is appended as its own extra row below the
// template, so no real figures are ever dropped.
const REVENUE_TEMPLATE: TemplateItem[] = [
  { label: 'Consultation Fees', keywords: ['consult'] },
  { label: 'Laboratory Fees', keywords: ['lab fee', 'laboratory fee', 'lab'] },
  { label: 'Pharmacy Sales', keywords: ['pharmac'] },
  { label: 'Procedures', keywords: ['procedure'] },
  { label: 'Registration Fees', keywords: ['regist'] },
  { label: 'Bed Charges', keywords: ['bed_charg', 'bed charg'] },
  { label: 'Other Income', keywords: ['other'] },
];

const COST_OF_SALES_TEMPLATE: TemplateItem[] = [
  { label: 'Cost of Medicines Sold', keywords: ['cost_of_medicines_sold', 'cost of medicines'] },
  { label: 'Medicines Purchased', keywords: ['medicine', 'drug'] },
  { label: 'Laboratory Supplies', keywords: ['lab supp', 'laboratory supp', 'lab'] },
  { label: 'Medical Consumables', keywords: ['consumable'] },
  { label: 'Other Direct Costs', keywords: ['other'] },
];

const OPERATING_EXPENSES_TEMPLATE: TemplateItem[] = [
  { label: 'Supplies', keywords: ['supplies', 'supply'] },
  { label: 'Utilities', keywords: ['utilities', 'utility'] },
  { label: 'Maintenance', keywords: ['maintenance'] },
  { label: 'Travel', keywords: ['travel'] },
  { label: 'Other', keywords: ['other'] },
];

function mergeWithTemplate(template: TemplateItem[], actual: LineItem[]): LineItem[] {
  const used = new Set<number>();
  const merged: LineItem[] = template.map((t) => {
    let total = 0;
    actual.forEach((item, idx) => {
      if (used.has(idx)) return;
      const norm = item.label.toLowerCase();
      if (t.keywords.some((k) => norm.includes(k))) {
        total += item.amount;
        used.add(idx);
      }
    });
    return { label: t.label, amount: total };
  });
  actual.forEach((item, idx) => {
    if (!used.has(idx)) merged.push(item);
  });
  return merged;
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------

function SectionHeaderRow({
  icon,
  label,
  tint,
  iconTint,
  textTint,
  isOpen,
  onToggle,
}: {
  icon: React.ReactNode;
  label: string;
  tint: string;
  iconTint: string;
  textTint: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <tr className={tint}>
      <td className="py-3 pl-4 pr-4 cursor-pointer select-none" colSpan={3} onClick={onToggle}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconTint}`}>{icon}</span>
            <span className={`text-[13px] font-bold tracking-wide ${textTint}`}>{label}</span>
          </div>
          <ChevronDown
            className={`h-4 w-4 flex-shrink-0 ${textTint} transition-transform ${isOpen ? '' : '-rotate-90'}`}
          />
        </div>
      </td>
    </tr>
  );
}

function LineRow({ label, amount, total }: { label: string; amount: number; total: number }) {
  return (
    <tr className="border-b border-slate-100">
      <td className="py-2.5 pl-14 pr-2 text-[14px] text-slate-700 capitalize">{label}</td>
      <td className="py-2.5 pr-8 text-right text-[14px] text-slate-800">${fmt(amount)}</td>
      <td className="py-2.5 pr-4 text-right text-[14px] text-slate-500">{pct(amount, total)}%</td>
    </tr>
  );
}

function TotalRow({
  label,
  amount,
  total,
  tint,
  textTint,
}: {
  label: string;
  amount: number;
  total: number;
  tint: string;
  textTint: string;
}) {
  return (
    <tr className={`${tint} border-t border-b border-black/5`}>
      <td className={`py-2.5 pl-14 pr-2 text-[14px] font-bold ${textTint}`}>{label}</td>
      <td className={`py-2.5 pr-8 text-right text-[14px] font-bold ${textTint}`}>${fmt(amount)}</td>
      <td className={`py-2.5 pr-4 text-right text-[14px] font-bold ${textTint}`}>{pct(amount, total)}%</td>
    </tr>
  );
}

function SummaryBand({
  icon,
  label,
  amount,
  total,
  tint,
  iconTint,
  textTint,
}: {
  icon: React.ReactNode;
  label: string;
  amount: number;
  total: number;
  tint: string;
  iconTint: string;
  textTint: string;
}) {
  return (
    <tr className={tint}>
      <td className="py-3.5 pl-4 pr-2">
        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-md ${iconTint}`}>{icon}</span>
          <span className={`text-[14px] font-extrabold tracking-wide ${textTint}`}>{label}</span>
        </div>
      </td>
      <td className={`py-3.5 pr-8 text-right text-[15px] font-extrabold ${textTint}`}>${fmt(amount)}</td>
      <td className={`py-3.5 pr-4 text-right text-[15px] font-extrabold ${textTint}`}>{pct(amount, total)}%</td>
    </tr>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-slate-300 bg-white py-2 px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type SectionKey = 'revenue' | 'costOfSales' | 'operatingExpenses';

export function ProfitLossPage() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState(daysAgoStr(29));
  const [dateTo, setDateTo] = useState(todayStr());

  // Cosmetic-only filters to match the design — the report endpoint only
  // takes a date range today. Wire these into reportsApi.getProfitLoss once
  // the backend accepts them.
  const [branch] = useState('Main Hospital');
  const [department, setDepartment] = useState('All Departments');
  const [paymentMethod, setPaymentMethod] = useState('All Payments');

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then((r) => r.data),
  });
  const departmentOptions = useMemo(
    () => ['All Departments', ...((departmentsData ?? []).map((d: any) => d.name))],
    [departmentsData],
  );

  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    revenue: true,
    costOfSales: true,
    operatingExpenses: true,
  });
  const toggleSection = (key: SectionKey) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['profit-loss', dateFrom, dateTo],
    queryFn: () => reportsApi.getProfitLoss(dateFrom, dateTo).then((r) => r.data as ProfitLossResponse),
  });

  const rawRevenue: LineItem[] = useMemo(
    () => (data?.byRevenueCategory ?? []).map((c) => ({ label: capitalize(c.category), amount: c.amount })),
    [data],
  );
  const rawCostOfSales: LineItem[] = useMemo(
    () =>
      (data?.byCategory ?? [])
        .filter((c) => isCostOfSales(c.category))
        .map((c) => ({ label: capitalize(c.category), amount: c.amount })),
    [data],
  );
  const rawOperatingExpenses: LineItem[] = useMemo(
    () =>
      (data?.byCategory ?? [])
        .filter((c) => !isCostOfSales(c.category))
        .map((c) => ({ label: c.category.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()), amount: c.amount })),
    [data],
  );

  const revenueItems = useMemo(() => mergeWithTemplate(REVENUE_TEMPLATE, rawRevenue), [rawRevenue]);
  const costOfSalesItems = useMemo(
    () => mergeWithTemplate(COST_OF_SALES_TEMPLATE, rawCostOfSales),
    [rawCostOfSales],
  );
  const operatingExpenseItems = useMemo(
    () => rawOperatingExpenses.filter((item) => item.amount > 0),
    [rawOperatingExpenses],
  );

  const totalRevenue = sum(revenueItems);
  const totalCostOfSales = sum(costOfSalesItems);
  const grossProfit = totalRevenue - totalCostOfSales;
  const totalOpEx = sum(operatingExpenseItems);
  const netProfit = data?.netProfit ?? grossProfit - totalOpEx;

  function exportToExcel() {
    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet([
      { Description: 'Total Revenue', Amount: totalRevenue },
      { Description: 'Total Cost of Sales', Amount: totalCostOfSales },
      { Description: 'Gross Profit', Amount: grossProfit },
      { Description: 'Total Operating Expenses', Amount: totalOpEx },
      { Description: 'Net Profit / Loss', Amount: netProfit },
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Summary');

    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(revenueItems.map((r) => ({ Description: r.label, Amount: r.amount }))),
      'Revenue',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(costOfSalesItems.map((r) => ({ Description: r.label, Amount: r.amount }))),
      'Cost of Sales',
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(operatingExpenseItems.map((r) => ({ Description: r.label, Amount: r.amount }))),
      'Operating Expenses',
    );

    XLSX.writeFile(wb, `profit_and_loss_${dateFrom}_to_${dateTo}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div>
        <button
          onClick={() => navigate('/billing/reports')}
          className="mb-2 flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
        >
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BarChart3 className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Profit &amp; Loss Report</h1>
            <p className="text-sm text-slate-500">Summary of income, costs and expenses for the selected period</p>
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
          <Field label="Date From">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>

          <Field label="Date To">
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 px-3 text-sm text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </Field>

          <Field label="Branch">
            <Select value={branch} onChange={() => {}} options={['Main Hospital']} />
          </Field>

          <Field label="Department">
            <Select
              value={department}
              onChange={setDepartment}
              options={departmentOptions}
            />
          </Field>

          <Field label="Payment Method">
            <Select
              value={paymentMethod}
              onChange={setPaymentMethod}
              options={['All Payments', 'Cash', 'Card', 'Insurance']}
            />
          </Field>

          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-[38px] items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
          >
            {isLoading ? 'Loading…' : 'Generate'}
          </button>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {isError && (
        <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-500">
          Couldn't load the P&amp;L report for this period. Try Generate again.
        </p>
      )}

      {/* Statement */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Statement header — no logo/branding here, the sidebar already carries it */}
        <div className="flex flex-col gap-4 border-b border-slate-100 bg-blue-50/40 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-xl font-extrabold text-blue-900">Profit &amp; Loss Statement</div>
            <div className="text-sm text-slate-500">
              From {displayDate(dateFrom)} to {displayDate(dateTo)}
            </div>
          </div>

          <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-1 text-right text-[13px] sm:text-left">
            <span className="font-semibold text-slate-500">Branch:</span>
            <span className="text-slate-700">{branch}</span>
            <span className="font-semibold text-slate-500">Department:</span>
            <span className="text-slate-700">{department}</span>
            <span className="font-semibold text-slate-500">Generated:</span>
            <span className="text-slate-700">{displayDate(todayStr())}</span>
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-sm text-slate-400">Loading…</p>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2.5 pl-4 text-left text-[13px] font-bold text-blue-900">Description</th>
                <th className="py-2.5 pr-8 text-right text-[13px] font-bold text-blue-900">Amount (USD)</th>
                <th className="py-2.5 pr-4 text-right text-[13px] font-bold text-blue-900">% of Revenue</th>
              </tr>
            </thead>
            <tbody>
              {/* 1. Revenue */}
              <SectionHeaderRow
                icon={<Landmark className="h-4 w-4 text-white" />}
                label="1. REVENUE / INCOME"
                tint="bg-blue-50"
                iconTint="bg-blue-600"
                textTint="text-blue-900"
                isOpen={openSections.revenue}
                onToggle={() => toggleSection('revenue')}
              />
              {openSections.revenue &&
                revenueItems
                  .filter((item) => item.amount > 0)
                  .map((item, i) => (
                    <LineRow key={`${item.label}-${i}`} label={item.label} amount={item.amount} total={totalRevenue} />
                  ))}
              {openSections.revenue && revenueItems.every((item) => item.amount === 0) && (
                <tr>
                  <td colSpan={3} className="py-3 pl-4 text-[13px] italic text-slate-400">
                    No revenue recorded for this period yet.
                  </td>
                </tr>
              )}
              <TotalRow
                label="Total Revenue"
                amount={totalRevenue}
                total={totalRevenue}
                tint="bg-blue-50"
                textTint="text-blue-900"
              />

              <tr>
                <td colSpan={3} className="h-4" />
              </tr>

              {/* 2. Cost of Sales */}
              <SectionHeaderRow
                icon={<Receipt className="h-4 w-4 text-white" />}
                label="2. COST OF SALES"
                tint="bg-rose-50"
                iconTint="bg-rose-500"
                textTint="text-rose-700"
                isOpen={openSections.costOfSales}
                onToggle={() => toggleSection('costOfSales')}
              />
              {openSections.costOfSales &&
                costOfSalesItems.map((item, i) => (
                  <LineRow key={`${item.label}-${i}`} label={item.label} amount={item.amount} total={totalRevenue} />
                ))}
              <TotalRow
                label="Total Cost of Sales"
                amount={totalCostOfSales}
                total={totalRevenue}
                tint="bg-rose-50"
                textTint="text-rose-700"
              />

              <tr>
                <td colSpan={3} className="h-4" />
              </tr>

              {/* 3. Gross Profit */}
              <SummaryBand
                icon={<TrendingUp className="h-4 w-4 text-white" />}
                label="3. GROSS PROFIT"
                amount={grossProfit}
                total={totalRevenue}
                tint="bg-emerald-50"
                iconTint="bg-emerald-500"
                textTint="text-emerald-700"
              />

              <tr>
                <td colSpan={3} className="h-4" />
              </tr>

              {/* 4. Operating Expenses */}
              <SectionHeaderRow
                icon={<Settings2 className="h-4 w-4 text-white" />}
                label="4. OPERATING EXPENSES"
                tint="bg-violet-50"
                iconTint="bg-violet-500"
                textTint="text-violet-700"
                isOpen={openSections.operatingExpenses}
                onToggle={() => toggleSection('operatingExpenses')}
              />
              {openSections.operatingExpenses &&
                operatingExpenseItems.map((item, i) => (
                  <LineRow key={`${item.label}-${i}`} label={item.label} amount={item.amount} total={totalRevenue} />
                ))}
              <TotalRow
                label="Total Operating Expenses"
                amount={totalOpEx}
                total={totalRevenue}
                tint="bg-violet-50"
                textTint="text-violet-700"
              />

              <tr>
                <td colSpan={3} className="h-4" />
              </tr>

              {/* 5. Net Profit / Loss */}
              <SummaryBand
                icon={<Landmark className="h-4 w-4 text-white" />}
                label="5. NET PROFIT / LOSS"
                amount={netProfit}
                total={totalRevenue}
                tint="bg-teal-50"
                iconTint="bg-teal-500"
                textTint="text-teal-700"
              />

              <tr>
                <td colSpan={3} className="h-3" />
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
