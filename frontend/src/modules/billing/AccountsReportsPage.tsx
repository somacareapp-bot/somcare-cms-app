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
