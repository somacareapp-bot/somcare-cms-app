import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Pill, ClipboardList, PackageCheck, AlertTriangle, ArrowRight } from 'lucide-react';
import { pharmacyApi } from '../../services/api';

interface DashboardStats {
  pendingCount: number;
  dispensedToday: number;
  lowStockCount: number;
  totalMedicines: number;
  lowStockItems: { id: string; name: string; stockQuantity: number; reorderLevel: number; unit: string }[];
}

export function PharmacyDashboardPage() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['pharmacy', 'dashboard'],
    queryFn: async () => {
      const res = await pharmacyApi.getDashboard();
      return res.data as DashboardStats;
    },
    refetchInterval: 30000,
  });

  const cards = [
    { label: 'Pending Prescriptions', value: data?.pendingCount, icon: ClipboardList, color: 'text-amber-600 bg-amber-50', path: '/pharmacy/dispensing' },
    { label: 'Dispensed Today', value: data?.dispensedToday, icon: PackageCheck, color: 'text-green-600 bg-green-50', path: '/pharmacy/prescriptions' },
    { label: 'Low Stock Items', value: data?.lowStockCount, icon: AlertTriangle, color: 'text-red-600 bg-red-50', path: '/pharmacy/low-stock' },
    { label: 'Total Medicines', value: data?.totalMedicines, icon: Pill, color: 'text-primary-600 bg-primary-50', path: '/pharmacy/medicines' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
          <Pill size={22} className="text-primary-600" /> Pharmacy Dashboard
        </h1>
        <p className="text-clinical-500 text-sm mt-1">Overview of prescriptions, dispensing, and stock.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-clinical-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((c) => (
              <button
                key={c.label}
                onClick={() => navigate(c.path)}
                className="bg-white rounded-xl border border-clinical-200 p-5 text-left hover:border-primary-300 transition-colors"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${c.color}`}>
                  <c.icon size={18} />
                </div>
                <p className="text-2xl font-bold text-clinical-900">{c.value ?? 0}</p>
                <p className="text-xs text-clinical-500 mt-1">{c.label}</p>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl border border-clinical-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-clinical-800">Needs Restocking</h3>
              <button
                onClick={() => navigate('/pharmacy/low-stock')}
                className="text-xs font-semibold text-primary-600 flex items-center gap-1 hover:underline"
              >
                View all <ArrowRight size={12} />
              </button>
            </div>
            {(!data?.lowStockItems || data.lowStockItems.length === 0) ? (
              <p className="text-sm text-clinical-400 text-center py-6">Stock levels look healthy.</p>
            ) : (
              <div className="space-y-2">
                {data.lowStockItems.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm py-2 border-b border-clinical-50 last:border-0">
                    <span className="font-medium text-clinical-800">{m.name}</span>
                    <span className="text-red-600 font-semibold text-xs">
                      {m.stockQuantity} {m.unit}(s) left · reorder at {m.reorderLevel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
