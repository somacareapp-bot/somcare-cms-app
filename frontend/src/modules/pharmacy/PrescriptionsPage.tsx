import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, ClipboardList } from 'lucide-react';
import { pharmacyApi } from '../../services/api';

interface PrescriptionRow {
  id: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  status: 'pending' | 'dispensed' | 'cancelled';
  quantity?: number;
  dispensedAt?: string;
  createdAt: string;
  visit: { visitNumber: string; patient: { firstName: string; lastName: string; patientNumber: string } };
  medicine?: { name: string; unit: string; sellPrice: number };
}

type Tab = 'all' | 'pending' | 'dispensed' | 'cancelled';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  dispensed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export function PrescriptionsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const { data: prescriptions, isLoading } = useQuery({
    queryKey: ['pharmacy', 'prescriptions', activeTab],
    queryFn: async () => {
      const res = await pharmacyApi.getPrescriptions(activeTab === 'all' ? undefined : activeTab);
      return res.data as PrescriptionRow[];
    },
    refetchInterval: 20000,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'dispensed', label: 'Dispensed' },
    { key: 'cancelled', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
          <ClipboardList size={22} className="text-primary-600" /> Prescriptions
        </h1>
        <p className="text-clinical-500 text-sm mt-1">All prescriptions issued across patient visits.</p>
      </div>

      <div className="flex gap-1 bg-clinical-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors ${
              activeTab === t.key ? 'bg-white text-clinical-900 shadow-sm' : 'text-clinical-500 hover:text-clinical-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : !prescriptions || prescriptions.length === 0 ? (
          <p className="text-center text-clinical-400 text-sm py-16">No prescriptions here.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinical-100 bg-clinical-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Drug</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Dosage</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Visit</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Total</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-50">
              {prescriptions.map((p) => (
                <tr key={p.id} className="hover:bg-clinical-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-clinical-900">{p.visit.patient.firstName} {p.visit.patient.lastName}</p>
                    <p className="text-xs text-clinical-400">{p.visit.patient.patientNumber}</p>
                  </td>
                  <td className="px-4 py-3 font-medium text-clinical-800">
                    {p.drugName}
                    {p.medicine && p.quantity && (
                      <p className="text-xs text-clinical-400">{p.quantity} {p.medicine.unit}(s) dispensed</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-clinical-500">
                    {[p.dose, p.frequency, p.duration].filter(Boolean).join(' · ') || '—'}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-clinical-400">{p.visit.visitNumber}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${STATUS_BADGE[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-clinical-800">
                    {p.status === 'dispensed' && p.medicine && p.quantity
                      ? `$${(Number(p.medicine.sellPrice) * p.quantity).toFixed(2)}`
                      : <span className="text-clinical-300 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-clinical-400">
                    {new Date(p.dispensedAt ?? p.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
