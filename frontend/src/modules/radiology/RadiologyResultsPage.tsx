import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { radiologyApi } from '../../services/api';

interface RadiologyOrder {
  id: string;
  radiologyOrderNumber: string;
  testName: string;
  status: string;
  completedAt: string | null;
  patient: { firstName: string; lastName: string; patientNumber: string };
}

export function RadiologyResultsPage() {
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['radiology', 'completed'],
    queryFn: async () => {
      const res = await radiologyApi.getAll('completed');
      return res.data as RadiologyOrder[];
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Completed radiology orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} completed</p>
        </div>
        <button onClick={() => navigate('/radiology')} className="text-sm text-blue-600 hover:underline">
          ← Back to queue
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Order</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Patient</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Studies</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Completed</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs font-semibold text-gray-500">{o.radiologyOrderNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{o.patient.firstName} {o.patient.lastName}</p>
                    <p className="text-xs text-gray-400">{o.patient.patientNumber}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.testName}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.completedAt ? new Date(o.completedAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => navigate(`/radiology/${o.id}/result`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-gray-400">
                    No completed radiology orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
