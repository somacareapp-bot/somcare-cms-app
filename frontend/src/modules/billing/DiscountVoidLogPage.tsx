import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileWarning } from 'lucide-react';

export function DiscountVoidLogPage() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div>
        <button onClick={() => navigate('/billing/reports')} className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:underline mb-2">
          <ArrowLeft size={12} /> Back to Reports
        </button>
        <h1 className="text-2xl font-bold text-clinical-900">Discount & Void Log</h1>
        <p className="text-clinical-500 text-sm mt-1">Audit trail of discounts applied and invoices voided.</p>
      </div>
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center">
        <FileWarning size={32} className="text-clinical-300 mx-auto mb-3" />
        <p className="text-sm font-semibold text-clinical-700">Not connected to a data source yet</p>
        <p className="text-xs text-clinical-400 mt-1 max-w-md mx-auto">
          This log needs the backend to record who applied a discount or voided an invoice, when, and why.
          Once that audit trail is written on the backend, this page can list it chronologically.
        </p>
      </div>
    </div>
  );
}
