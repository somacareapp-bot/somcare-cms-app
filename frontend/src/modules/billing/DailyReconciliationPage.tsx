import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';

export function DailyReconciliationPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate('/billing/reports')} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mb-2">
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <h1 className="text-2xl font-bold text-clinical-900">Daily Reconciliation</h1>
        <p className="text-clinical-500 text-sm mt-1">Compare expected vs. actual cash at close of day.</p>
      </div>
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
        <ClipboardCheck size={32} className="text-clinical-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-clinical-700">Not connected to a data source yet</p>
        <p className="text-xs text-clinical-400 mt-1 max-w-md mx-auto">
          This report needs a backend endpoint that totals cash payments recorded per day and compares them
          against a manually entered closing count. Once that endpoint exists, this page can show the
          day-by-day reconciliation table.
        </p>
      </div>
    </div>
  );
}
