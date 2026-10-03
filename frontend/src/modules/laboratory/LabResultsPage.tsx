import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { labApi } from '../../services/api';

type Flag = 'low' | 'high' | 'normal' | null;

interface LabOrderItem {
  id: string;
  testName: string;
  category: string;
  unit: string | null;
  referenceRange: string | null;
  resultValue: string | null;
  flag: Flag;
}

interface LabOrder {
  id: string;
  labOrderNumber: string;
  testName: string;
  status: string;
  orderedAt: string;
  completedAt: string | null;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string };
  items: LabOrderItem[];
}

function FlagBadge({ flag }: { flag: Flag }) {
  if (!flag) return <span className="text-gray-300">—</span>;
  const styles: Record<string, string> = {
    high:   'bg-red-50 text-red-700 border border-red-200',
    low:    'bg-amber-50 text-amber-700 border border-amber-200',
    normal: 'bg-green-50 text-green-700 border border-green-200',
  };
  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${styles[flag]}`}>
      {flag === 'high' ? 'H' : flag === 'low' ? 'L' : 'N'}
    </span>
  );
}

function hasCritical(items: LabOrderItem[]) {
  return items.some((i) => i.flag === 'high' || i.flag === 'low');
}

export function LabResultsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: orders = [], isLoading } = useQuery<LabOrder[]>({
    queryKey: ['lab-completed'],
    queryFn: () => labApi.getAll('completed').then((r) => r.data),
  });

  const filtered = orders.filter((o) => {
    const q = search.toLowerCase();
    return (
      o.labOrderNumber.toLowerCase().includes(q) ||
      `${o.patient.firstName} ${o.patient.lastName}`.toLowerCase().includes(q) ||
      o.patient.patientNumber.toLowerCase().includes(q) ||
      o.testName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Completed results</h1>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} result{orders.length !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/laboratory')}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          ← Queue
        </button>
      </div>

      {/* Search */}
      <input
        type="search"
        placeholder="Search by patient, order number or test…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-100"
      />

      {/* List */}
      {isLoading && (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          {search ? 'No results match your search.' : 'No completed orders yet.'}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((order) => {
          const isOpen = expanded === order.id;
          const critical = hasCritical(order.items);

          return (
            <div
              key={order.id}
              className="bg-white border border-gray-200 rounded-2xl overflow-hidden"
            >
              {/* Row header */}
              <button
                onClick={() => setExpanded(isOpen ? null : order.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left"
              >
                {/* Critical indicator */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${critical ? 'bg-red-400' : 'bg-green-400'}`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 text-sm">
                      {order.patient.firstName} {order.patient.lastName}
                    </span>
                    <span className="text-xs text-gray-400">{order.patient.patientNumber}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{order.testName}</p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-mono text-gray-400">{order.labOrderNumber}</span>
                  {critical && (
                    <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
                      Critical
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {order.completedAt
                      ? new Date(order.completedAt).toLocaleDateString()
                      : '—'}
                  </span>
                  <span className="text-gray-400 text-xs">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {/* Expanded results */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Test</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Result</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Unit</th>
                        <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Reference</th>
                        <th className="text-center px-4 py-2.5 text-xs font-medium text-gray-400 uppercase tracking-wide">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((item, idx) => (
                        <tr
                          key={item.id}
                          className={`border-t border-gray-50 ${
                            item.flag === 'high' ? 'bg-red-50/40' :
                            item.flag === 'low'  ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="px-5 py-3 font-medium text-gray-900">{item.testName}</td>
                          <td className={`px-4 py-3 font-semibold ${
                            item.flag === 'high' ? 'text-red-700' :
                            item.flag === 'low'  ? 'text-amber-700' :
                            item.flag === 'normal' ? 'text-green-700' :
                            'text-gray-400'
                          }`}>
                            {item.resultValue ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-gray-500">{item.unit || '—'}</td>
                          <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                            {item.referenceRange || '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <FlagBadge flag={item.flag} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end px-5 py-3 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/laboratory/${order.id}/result`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open full view →
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
