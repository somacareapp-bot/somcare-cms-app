import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity, AlertCircle, CalendarDays, ClipboardList, FlaskConical,
  Download, Loader2, PackageSearch, Pill, Printer, Search, Stethoscope, TestTube2, Wallet,
} from 'lucide-react';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { reportsApi } from '../../services/api';

// ───────────────────────── helpers ─────────────────────────

const fmt = (n: number) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n: number) => Number(n || 0).toLocaleString();
const humanize = (s: string) => String(s ?? '').replace(/_/g, ' ');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number) => String(n).padStart(2, '0');

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

const defaultFrom = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`;
};

const fmtDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const rangeLabel = (from: string, to: string) =>
  from === to ? fmtDate(from) : `${fmtDate(from)} \u2013 ${fmtDate(to)}`;

type TabKey = 'visits' | 'diagnosis' | 'labRevenue' | 'expenses' | 'lab' | 'pharmacy' | 'staff' | 'inventory';

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'visits',     label: 'Clinical',        icon: Stethoscope },
  { key: 'diagnosis',  label: 'Diagnoses',       icon: ClipboardList },
  { key: 'labRevenue', label: 'Lab revenue',     icon: TestTube2 },
  { key: 'expenses',   label: 'Expenses',        icon: Wallet },
  { key: 'lab',        label: 'Lab supplies',    icon: FlaskConical },
  { key: 'pharmacy',   label: 'Pharmacy',        icon: Pill },
  { key: 'staff',      label: 'Staff activity',  icon: Activity },
  { key: 'inventory',  label: 'Inventory value', icon: PackageSearch },
];

const FETCHERS: Record<TabKey, (from: string, to: string) => Promise<any>> = {
  visits:     (from, to) => reportsApi.getMonthlyVisits(from, to),
  diagnosis:  (from, to) => reportsApi.getMonthlyDiagnosis(from, to),
  labRevenue: (from, to) => reportsApi.getMonthlyLabRevenue(from, to),
  expenses:   (from, to) => reportsApi.getMonthlyExpenses(from, to),
  lab:        (from, to) => reportsApi.getMonthlyLabSupplies(from, to),
  pharmacy:   (from, to) => reportsApi.getMonthlyPharmacy(from, to),
  staff:      (from, to) => reportsApi.getMonthlyStaffActivity(from, to),
  inventory:  (from, to) => reportsApi.getMonthlyInventoryValuation(from, to),
};

// ───────────────────────── small UI pieces ─────────────────────────

function Kpi({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'green' | 'amber' | 'red' | 'blue' }) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900',
    green: 'text-emerald-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 break-inside-avoid">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Empty({ text = 'No data for this period.' }: { text?: string }) {
  return <p className="py-4 text-center text-sm text-slate-400">{text}</p>;
}

/** Ranked list of { key, count } with a proportional bar. */
function RankList({ rows }: { rows: { key: string; count: number }[] }) {
  if (!rows?.length) return <Empty />;
  const max = Math.max(...rows.map(r => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.map(r => (
        <li key={r.key} className="text-sm">
          <div className="flex justify-between">
            <span className="capitalize text-slate-700">{humanize(r.key)}</span>
            <span className="font-medium text-slate-900">{num(r.count)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded bg-slate-100">
            <div className="h-1.5 rounded bg-blue-500" style={{ width: `${(r.count / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function DailyBars({ data, label = 'per day' }: { data: { date: string; count: number }[]; label?: string }) {
  if (!data?.length || data.every(d => d.count === 0)) return <Empty />;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div>
      <div className="flex h-40 items-end gap-0.5 pt-4">
        {data.map(d => {
          const pct = Math.max((d.count / max) * 100, d.count ? 4 : 1);
          return (
            <div
              key={d.date}
              title={`${d.date}: ${d.count} ${label}`}
              className="relative flex h-full flex-1 items-end"
            >
              {d.count > 0 && (
                <span
                  className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-[9px] font-medium text-slate-500"
                  style={{ bottom: `calc(${pct}% + 3px)` }}
                >
                  {d.count}
                </span>
              )}
              <div
                className="w-full rounded-t bg-blue-500/80 hover:bg-blue-600"
                style={{ height: `${pct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-400">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  );
}

function Table({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  if (!rows.length) return <Empty />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={h} className={`py-2 pr-3 font-medium ${i > 0 ? 'text-right' : ''}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-slate-100 last:border-0">
              {r.map((c, ci) => (
                <td key={ci} className={`py-2 pr-3 ${ci > 0 ? 'text-right' : 'capitalize text-slate-700'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────── report bodies ─────────────────────────

function VisitsReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Visits" value={num(t.visits)} tone="blue" />
        <Kpi label="Completed" value={num(t.completed)} tone="green" />
        <Kpi label="Cancelled" value={num(t.cancelled)} tone="amber" />
        <Kpi label="Emergency" value={num(t.emergency)} tone="red" />
        <Kpi label="New patients" value={num(t.newPatients)} />
        <Kpi label="Appointments" value={num(t.appointmentsBooked)} />
      </div>
      <Card title="Visits per day"><DailyBars data={d.daily} label="visits" /></Card>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card title="By status"><RankList rows={d.byStatus} /></Card>
        <Card title="By urgency"><RankList rows={d.byUrgency} /></Card>
        <Card title="New patients by gender"><RankList rows={d.newPatientsByGender} /></Card>
        <Card title="By department"><RankList rows={d.byDepartment} /></Card>
        <Card title="By doctor"><RankList rows={d.byDoctor} /></Card>
      </div>
    </div>
  );
}

function ExpensesReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Expenses" value={num(t.count)} />
        <Kpi label="Submitted" value={fmt(t.submittedAmount)} tone="blue" />
        <Kpi label="Paid" value={fmt(t.paidAmount)} tone="green" />
        <Kpi label="Awaiting approval" value={fmt(t.awaitingApprovalAmount)} tone="amber" />
        <Kpi label="Approved, unpaid" value={fmt(t.approvedUnpaidAmount)} tone="amber" />
        <Kpi label="Rejected" value={fmt(t.rejectedAmount)} tone="red" />
      </div>
      <Card title="Expenses per day"><DailyBars data={d.daily} label="expenses" /></Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="By category">
          <Table
            head={['Category', 'Count', 'Total']}
            rows={(d.byCategory ?? []).map((r: any) => [humanize(r.category), num(r.count), fmt(r.total)])}
          />
        </Card>
        <Card title="By status">
          <Table
            head={['Status', 'Count', 'Total']}
            rows={(d.byStatus ?? []).map((r: any) => [humanize(r.status), num(r.count), fmt(r.total)])}
          />
        </Card>
      </div>
    </div>
  );
}

type StockCol = { key: string; label: string; kind: 'qty' | 'money' };

function StockMovementTable({
  title, subtitle, nameLabel, rows, cols, movementKeys, fileBase, period, unitKey,
}: {
  title: string;
  subtitle: string;
  nameLabel: string;
  rows: any[];
  cols: StockCol[];
  movementKeys: string[];
  fileBase: string;
  period: string;
  unitKey?: string;
}) {
  const [q, setQ] = useState('');
  const [onlyMoved, setOnlyMoved] = useState(false);

  const needle = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((r: any) => {
    if (needle && !String(r.name ?? '').toLowerCase().includes(needle)) return false;
    if (onlyMoved && !movementKeys.some(k => Number(r[k] || 0) > 0)) return false;
    return true;
  });

  const totals: Record<string, number> = {};
  cols.forEach(c => {
    totals[c.key] = shown.reduce((s: number, r: any) => s + Number(r[c.key] || 0), 0);
  });

  const show = (c: StockCol, v: number) => (c.kind === 'money' ? fmt(v) : num(v));

  const exportXlsx = () => {
    const header = [nameLabel, ...(unitKey ? ['Unit'] : []), ...cols.map(c => c.label)];
    const body = shown.map((r: any) => [
      String(r.name ?? ''),
      ...(unitKey ? [String(r[unitKey] ?? '')] : []),
      ...cols.map(c => Number(r[c.key] || 0)),
    ]);
    const foot = ['TOTAL', ...(unitKey ? [''] : []), ...cols.map(c => totals[c.key])];
    const ws = XLSX.utils.aoa_to_sheet([header, ...body, foot]);
    const unitOffset = unitKey ? 1 : 0;
    ws['!cols'] = [{ wch: 34 }, ...(unitKey ? [{ wch: 10 }] : []), ...cols.map(() => ({ wch: 16 }))];
    for (let i = 1; i <= body.length + 1; i++) {
      cols.forEach((c, j) => {
        if (c.kind !== 'money') return;
        const cell = ws[XLSX.utils.encode_cell({ r: i, c: j + 1 + unitOffset })];
        if (cell) cell.z = '$#,##0.00';
      });
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock movement');
    XLSX.writeFile(wb, `${fileBase}-${period}.xlsx`);
  };

  return (
    <Card title={title}>
      <p className="-mt-2 mb-3 text-xs text-slate-500">{subtitle}</p>
      <div className="mb-3 flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={`Filter by ${nameLabel.toLowerCase()} name...`}
            className="w-64 rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={onlyMoved} onChange={e => setOnlyMoved(e.target.checked)} />
          Only items with movement
        </label>
        <button
          type="button"
          onClick={exportXlsx}
          disabled={!shown.length}
          className="ml-auto inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <Download className="h-4 w-4" /> Download Excel
        </button>
      </div>
      {!shown.length ? (
        <Empty text="No matching items." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-3 text-left font-medium">{nameLabel}</th>
                {unitKey && <th className="px-3 py-2 text-left font-medium">Unit</th>}
                {cols.map(c => (
                  <th key={c.key} className="px-3 py-2 text-right font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((r: any, i: number) => (
                <tr key={`${r.name}-${i}`} className="border-b border-slate-100">
                  <td className="py-2 pr-3 text-slate-800">{r.name}</td>
                  {unitKey && <td className="px-3 py-2 text-left text-slate-500">{r[unitKey] ?? ''}</td>}
                  {cols.map(c => (
                    <td key={c.key} className="px-3 py-2 text-right tabular-nums text-slate-700">{show(c, Number(r[c.key] || 0))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold text-slate-900">
                <td className="py-2 pr-3">Total ({shown.length} {shown.length === 1 ? 'item' : 'items'})</td>
                {unitKey && <td />}
                {cols.map(c => (
                  <td key={c.key} className="px-3 py-2 text-right tabular-nums">{show(c, totals[c.key])}</td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </Card>
  );
}

function periodOf(d: any): string {
  const daily = d?.daily;
  if (Array.isArray(daily) && daily.length) return `${daily[0].date}_to_${daily[daily.length - 1].date}`;
  return todayStr();
}

function LabReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Stock movements" value={num(t.movements)} />
        <Kpi label="Restocked qty" value={num(t.restockedQty)} tone="green" />
        <Kpi label="Restock cost" value={fmt(t.restockedCost)} tone="green" />
        <Kpi label="Issued qty" value={num(t.issuedQty)} tone="amber" />
        <Kpi label="Issued cost" value={fmt(t.issuedCost)} tone="amber" />
        <Kpi label="Auto-used by lab orders" value={`${num(t.autoConsumedByLabOrders)} \u00b7 ${fmt(t.autoConsumedCost)}`} tone="blue" />
      </div>
      <Card title="Stock movements per day"><DailyBars data={d.daily} label="movements" /></Card>
      <StockMovementTable
        title="Lab supply stock movement"
        subtitle="Opening + Restocked - Used = Ending balance, per supply. Ending balance is the live stock level."
        nameLabel="Supply"
        rows={d.bySupply ?? []}
        cols={[
          { key: 'openingQty', label: 'Opening', kind: 'qty' },
          { key: 'restockedQty', label: 'Restocked', kind: 'qty' },
          { key: 'restockedCost', label: 'Restock cost', kind: 'money' },
          { key: 'issuedQty', label: 'Used', kind: 'qty' },
          { key: 'issuedCost', label: 'Used cost', kind: 'money' },
          { key: 'endingQty', label: 'Ending balance', kind: 'qty' },
        ]}
        movementKeys={['restockedQty', 'issuedQty']}
        unitKey="unit"
        fileBase="lab-supplies-stock"
        period={periodOf(d)}
      />
    </div>
  );
}

function StaffReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  const empty = !t.actions;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Logged actions" value={num(t.actions)} tone="blue" />
        <Kpi label="Active staff" value={num(t.activeStaff)} />
      </div>
      {empty && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          No staff activity has been logged for this period yet. This report fills in once actions are written to the activity log.
        </div>
      )}
      <Card title="Actions per day"><DailyBars data={d.daily} label="actions" /></Card>
      <Card title="By staff member">
        <Table
          head={['Staff', 'Role', 'Actions', 'Top actions', 'Last active']}
          rows={(d.byStaff ?? []).map((u: any) => [
            u.userName,
            humanize(u.userRole ?? '—'),
            num(u.total),
            Object.entries(u.actions ?? {})
              .sort((a: any, b: any) => b[1] - a[1])
              .slice(0, 3)
              .map(([k, v]) => `${humanize(k)} (${v})`)
              .join(', '),
            u.lastActive ? new Date(u.lastActive).toLocaleString() : '—',
          ])}
        />
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="By action"><RankList rows={d.byAction} /></Card>
        <Card title="By record type"><RankList rows={d.byEntityType} /></Card>
      </div>
    </div>
  );
}


function DiagnosisReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi label="Total visits" value={num(t.totalVisits)} tone="blue" />
        <Kpi label="Diagnosed" value={num(t.diagnosedVisits)} tone="green" />
        <Kpi label="No diagnosis recorded" value={num(t.undocumented)} tone="amber" />
      </div>
      <Card title="Diagnosed visits per day"><DailyBars data={d.daily} label="visits" /></Card>
      <Card title="Top diagnoses"><RankList rows={d.byDiagnosis} /></Card>
    </div>
  );
}

function LabRevenueReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Tests completed" value={num(t.testsCompleted)} tone="blue" />
        <Kpi label="Revenue" value={fmt(t.totalRevenue)} tone="green" />
        <Kpi label="Material cost" value={fmt(t.totalCost)} tone="amber" />
        <Kpi label="Gross profit" value={fmt(t.grossProfit)} tone="green" />
        <Kpi label="Margin" value={`${num(t.marginPct)}%`} />
        <Kpi label="Unconfigured tests" value={num(t.unconfiguredTests)} tone="red" />
      </div>
      <Card title="Revenue per day"><DailyBars data={d.daily} label="tests" /></Card>
      <Card title="By test">
        <Table
          head={['Test', 'Count', 'Revenue', 'Cost', 'Gross profit']}
          rows={(d.byTest ?? []).map((x: any) => [x.testName, num(x.count), fmt(x.revenue), fmt(x.cost), fmt(x.grossProfit)])}
        />
      </Card>
    </div>
  );
}

function PharmacyReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Rx dispensed" value={num(t.rxDispensedCount)} tone="blue" />
        <Kpi label="Rx revenue" value={fmt(t.rxRevenue)} tone="green" />
        <Kpi label="POS sales" value={num(t.posSalesCount)} tone="blue" />
        <Kpi label="POS revenue" value={fmt(t.posRevenue)} tone="green" />
        <Kpi label="POS gross profit" value={fmt(t.posGrossProfit)} tone="green" />
        <Kpi label="Stock value on hand" value={fmt(t.currentStockValue)} />
      </div>
      {t.lowStockCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {num(t.lowStockCount)} medicine(s) at or below reorder level.
        </div>
      )}
      <Card title="Dispensing per day"><DailyBars data={d.daily} label="prescriptions" /></Card>
      <StockMovementTable
        title="Pharmacy stock movement"
        subtitle="Opening + Restocked - Total used (Rx + POS) = Ending balance, per medicine. Ending balance is the live stock level."
        nameLabel="Medicine"
        rows={d.byMedicine ?? []}
        cols={[
          { key: 'openingQty', label: 'Opening', kind: 'qty' },
          { key: 'restockedQty', label: 'Restocked', kind: 'qty' },
          { key: 'dispensedQty', label: 'Used (Rx)', kind: 'qty' },
          { key: 'posQty', label: 'Used (POS)', kind: 'qty' },
          { key: 'usedQty', label: 'Total used', kind: 'qty' },
          { key: 'endingQty', label: 'Ending balance', kind: 'qty' },
          { key: 'revenue', label: 'Revenue', kind: 'money' },
        ]}
        movementKeys={['restockedQty', 'usedQty']}
        unitKey="unit"
        fileBase="pharmacy-stock"
        period={periodOf(d)}
      />
    </div>
  );
}

function InventoryValuationReport({ d }: { d: any }) {
  const t = d.totals ?? {};
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Lab supplies value" value={fmt(t.labSuppliesValue)} tone="blue" />
        <Kpi label="Medicines value" value={fmt(t.medicinesValue)} tone="blue" />
        <Kpi label="Total value" value={fmt(t.totalValue)} tone="green" />
        <Kpi label="Lab low stock" value={num(t.labSuppliesLowStock)} tone="amber" />
        <Kpi label="Medicine low stock" value={num(t.medicinesLowStock)} tone="amber" />
        <Kpi label="Near expiry (90d)" value={num(t.nearExpiryCount)} tone="red" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Lab supplies by category"><RankList rows={d.byLabCategory} /></Card>
        <Card title="Medicines by category"><RankList rows={d.byMedicineCategory} /></Card>
      </div>
      <Card title="Near-expiry items">
        <Table
          head={['Item', 'Type', 'Expiry date', 'Stock qty']}
          rows={(d.nearExpiry ?? []).map((x: any) => [
            x.name, x.type === 'lab_supply' ? 'Lab supply' : 'Medicine',
            x.expiryDate ? new Date(x.expiryDate).toLocaleDateString() : '—',
            num(x.stockQuantity),
          ])}
        />
      </Card>
    </div>
  );
}

// ───────────────────────── page ─────────────────────────

export default function MonthlyReportsPage() {
  // tab + date range live in the URL so sidebar links can deep-link:
  // ?tab=expenses&from=2026-09-01&to=2026-09-24
  const [params, setParams] = useSearchParams();
  const rawTab = params.get('tab');
  const tab: TabKey = TABS.some(t => t.key === rawTab) ? (rawTab as TabKey) : 'visits';
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = rawFrom && DATE_RE.test(rawFrom) ? rawFrom : defaultFrom();
  const to = rawTo && DATE_RE.test(rawTo) ? rawTo : todayStr();

  const setTab = (t: TabKey) =>
    setParams(prev => {
      const n = new URLSearchParams(prev);
      n.set('tab', t);
      return n;
    }, { replace: true });

  const setRange = (nextFrom: string, nextTo: string) => {
    setParams(prev => {
      const n = new URLSearchParams(prev);
      n.set('from', nextFrom);
      n.set('to', nextTo);
      return n;
    }, { replace: true });
  };

  const resetToThisMonth = () => setRange(defaultFrom(), todayStr());

  const rangeValid = DATE_RE.test(from) && DATE_RE.test(to) && from <= to;

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: ['monthly-report', tab, from, to],
    queryFn: () => FETCHERS[tab](from, to).then((r: any) => r?.data ?? r),
    enabled: rangeValid,
  });

  const isDefaultRange = from === defaultFrom() && to === todayStr();

  return (
    <div className="space-y-5 p-6">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Monthly reports</h1>
          <p className="text-sm text-slate-500">{rangeLabel(from, to)}{isFetching && !isLoading ? ' \u00b7 refreshing\u2026' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <div className="flex items-center rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 py-2 pl-3 pr-2.5">
              <CalendarDays size={15} className="text-slate-400" />
              <div className="flex flex-col leading-tight">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">From</span>
                <input
                  type="date"
                  value={from}
                  max={to}
                  onChange={e => e.target.value && setRange(e.target.value, to)}
                  className="border-0 bg-transparent p-0 text-sm font-medium text-slate-800 focus:outline-none"
                  aria-label="From date"
                />
              </div>
            </div>
            <div className="h-9 w-px bg-slate-200" />
            <div className="flex flex-col py-2 pl-2.5 pr-3 leading-tight">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">To</span>
              <input
                type="date"
                value={to}
                min={from}
                max={todayStr()}
                onChange={e => e.target.value && setRange(from, e.target.value)}
                className="border-0 bg-transparent p-0 text-sm font-medium text-slate-800 focus:outline-none"
                aria-label="To date"
              />
            </div>
          </div>
          <button
            onClick={resetToThisMonth}
            disabled={isDefaultRange}
            className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors ${
              isDefaultRange
                ? 'cursor-default border-blue-200 bg-blue-50 text-blue-600'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            This month
          </button>
          <button
            onClick={() => window.print()}
            className="ml-1 flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
          >
            <Printer size={16} /> Print
          </button>
        </div>
      </div>

      {/* tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 print:hidden">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
                active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon size={16} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* body */}
      {!rangeValid ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p>The start date must be on or before the end date.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="mr-2 animate-spin" size={20} /> Loading report…
        </div>
      ) : isError ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Could not load this report.</p>
            <p className="text-red-600">
              {(error as any)?.response?.data?.message ?? (error as any)?.message ?? 'Unknown error'}
            </p>
          </div>
        </div>
      ) : data ? (
        <>
          {tab === 'visits' && <VisitsReport d={data} />}
          {tab === 'diagnosis' && <DiagnosisReport d={data} />}
          {tab === 'labRevenue' && <LabRevenueReport d={data} />}
          {tab === 'expenses' && <ExpensesReport d={data} />}
          {tab === 'lab' && <LabReport d={data} />}
          {tab === 'pharmacy' && <PharmacyReport d={data} />}
          {tab === 'staff' && <StaffReport d={data} />}
          {tab === 'inventory' && <InventoryValuationReport d={data} />}
        </>
      ) : null}
    </div>
  );
}
