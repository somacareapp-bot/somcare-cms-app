#!/bin/bash
set -e

echo "=============================================="
echo "Building real Profit & Loss frontend page"
echo "=============================================="

python3 - << 'PYEOF'
path = "src/services/api.ts"
with open(path) as f:
    content = f.read()

def replace_once(content, old, new, label):
    n = content.count(old)
    if n != 1:
        print(f"WARNING: expected 1 match for '{label}', found {n}")
        raise SystemExit(1)
    return content.replace(old, new)

old = """// Dashboard endpoints
export const dashboardApi = {
  getStats: (params?: any) => api.get('/api/reports/dashboard', { params }),
};"""
new = """// Dashboard endpoints
export const dashboardApi = {
  getStats: (params?: any) => api.get('/api/reports/dashboard', { params }),
};

// Reports endpoints
export const reportsApi = {
  getProfitLoss: (from?: string, to?: string) =>
    api.get('/api/reports/profit-loss', { params: { from, to } }),
};"""
content = replace_once(content, old, new, "reportsApi")

with open(path, "w") as f:
    f.write(content)
print("api.ts updated — reportsApi.getProfitLoss() added.")
PYEOF

cp src/modules/billing/ProfitLossPage.tsx src/modules/billing/ProfitLossPage.tsx.bak 2>/dev/null || true

cat > src/modules/billing/ProfitLossPage.tsx << 'EOF'
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { reportsApi } from '../../services/api';

interface ProfitLossData {
  from: string;
  to: string;
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  incomeByMethod: Record<string, number>;
  expensesByCategory: Record<string, number>;
  byDay: { date: string; income: number; expenses: number; net: number }[];
  paymentCount: number;
  expenseCount: number;
}

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const inputCls =
  'border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-colors';

export function ProfitLossPage() {
  const navigate = useNavigate();
  const [from, setFrom] = useState(daysAgoStr(29));
  const [to, setTo] = useState(todayStr());

  const { data, isLoading, isError } = useQuery({
    queryKey: ['profit-loss', from, to],
    queryFn: () => reportsApi.getProfitLoss(from, to).then((r) => r.data as ProfitLossData),
  });

  const maxDayValue = data
    ? Math.max(1, ...data.byDay.map((d) => Math.max(d.income, d.expenses)))
    : 1;

  function exportToExcel() {
    if (!data) return;
    const summaryRows = [
      { Metric: 'Period', Value: `${data.from} to ${data.to}` },
      { Metric: 'Total Income', Value: data.totalIncome },
      { Metric: 'Total Expenses', Value: data.totalExpenses },
      { Metric: 'Net Profit', Value: data.netProfit },
      { Metric: 'Payments Recorded', Value: data.paymentCount },
      { Metric: 'Approved Expenses', Value: data.expenseCount },
    ];
    const dayRows = data.byDay.map((d) => ({
      Date: d.date,
      Income: d.income,
      Expenses: d.expenses,
      Net: d.net,
    }));
    const incomeRows = Object.entries(data.incomeByMethod).map(([method, amount]) => ({
      'Payment Method': method,
      Amount: amount,
    }));
    const expenseRows = Object.entries(data.expensesByCategory).map(([category, amount]) => ({
      Category: category,
      Amount: amount,
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dayRows), 'By Day');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(incomeRows), 'Income by Method');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenseRows), 'Expenses by Category');
    XLSX.writeFile(wb, `profit_loss_${data.from}_to_${data.to}.xlsx`);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate('/billing/reports')}
            className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mb-2"
          >
            <ArrowLeft size={12} /> Back to Reports
          </button>
          <h1 className="text-2xl font-bold text-clinical-900">Profit & Loss</h1>
          <p className="text-clinical-500 text-sm mt-1">
            Income from recorded payments vs. approved expenses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-clinical-200 px-3 py-2 shadow-sm">
          <span className="text-xs font-semibold text-clinical-500">Period:</span>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} style={{ flex: '0 1 150px' }} />
          <span className="text-xs text-clinical-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} style={{ flex: '0 1 150px' }} />
          <button
            onClick={exportToExcel}
            disabled={!data}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-clinical-200 text-clinical-700 hover:border-primary-400 hover:text-primary-600 disabled:opacity-40 transition-colors"
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
          <p className="text-sm text-clinical-400">Loading…</p>
        </div>
      ) : isError || !data ? (
        <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
          <p className="text-sm text-red-500">Couldn't load the report. Try refreshing.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-clinical-200 p-5 flex items-start gap-4 shadow-sm">
              <div className="p-3 rounded-xl bg-emerald-500 shadow-sm shadow-emerald-200">
                <TrendingUp size={22} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-clinical-500 font-medium">Total Income</p>
                <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(data.totalIncome)}</p>
                <p className="text-[11px] text-clinical-400 mt-0.5">{data.paymentCount} payment{data.paymentCount === 1 ? '' : 's'}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-clinical-200 p-5 flex items-start gap-4 shadow-sm">
              <div className="p-3 rounded-xl bg-rose-500 shadow-sm shadow-rose-200">
                <TrendingDown size={22} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-clinical-500 font-medium">Total Expenses</p>
                <p className="text-2xl font-bold text-clinical-900 mt-0.5">${fmt(data.totalExpenses)}</p>
                <p className="text-[11px] text-clinical-400 mt-0.5">{data.expenseCount} approved</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-clinical-200 p-5 flex items-start gap-4 shadow-sm">
              <div className={`p-3 rounded-xl shadow-sm ${data.netProfit >= 0 ? 'bg-primary-600 shadow-primary-200' : 'bg-amber-500 shadow-amber-200'}`}>
                <Wallet size={22} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-clinical-500 font-medium">Net Profit</p>
                <p className={`text-2xl font-bold mt-0.5 ${data.netProfit >= 0 ? 'text-clinical-900' : 'text-amber-600'}`}>
                  ${fmt(data.netProfit)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-clinical-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-clinical-800 mb-4">Income vs. Expenses by Day</h3>
            {data.byDay.length === 0 ? (
              <p className="text-sm text-clinical-400 text-center py-8">No activity in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="flex items-end gap-2 h-40 min-w-max px-1">
                  {data.byDay.map((d) => (
                    <div key={d.date} className="flex flex-col items-center gap-1 w-6" title={`${d.date}: +$${fmt(d.income)} / -$${fmt(d.expenses)}`}>
                      <div className="flex items-end gap-0.5 h-32">
                        <div
                          className="w-2.5 bg-emerald-400 rounded-t"
                          style={{ height: `${Math.max(2, (d.income / maxDayValue) * 100)}%` }}
                        />
                        <div
                          className="w-2.5 bg-rose-400 rounded-t"
                          style={{ height: `${Math.max(2, (d.expenses / maxDayValue) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-clinical-400 rotate-45 origin-top-left whitespace-nowrap mt-1">
                        {d.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-4 mt-6 text-xs text-clinical-500">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Income</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-400" /> Expenses</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-clinical-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-clinical-800 mb-3">Income by Payment Method</h3>
              {Object.keys(data.incomeByMethod).length === 0 ? (
                <p className="text-sm text-clinical-400 text-center py-6">No payments recorded.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(data.incomeByMethod).map(([method, amount]) => (
                      <tr key={method} className="border-t border-clinical-50">
                        <td className="py-2 text-clinical-600 capitalize">{method}</td>
                        <td className="py-2 text-right font-semibold text-clinical-900">${fmt(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-clinical-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-clinical-800 mb-3">Expenses by Category</h3>
              {Object.keys(data.expensesByCategory).length === 0 ? (
                <p className="text-sm text-clinical-400 text-center py-6">No approved expenses in this period.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(data.expensesByCategory).map(([category, amount]) => (
                      <tr key={category} className="border-t border-clinical-50">
                        <td className="py-2 text-clinical-600 capitalize">{category}</td>
                        <td className="py-2 text-right font-semibold text-clinical-900">${fmt(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
EOF

echo "ProfitLossPage.tsx rewritten with real data."
echo ""
echo "=============================================="
echo "Frontend done. Restart the frontend dev server and check"
echo "  /billing/reports/profit-loss"
echo "=============================================="
