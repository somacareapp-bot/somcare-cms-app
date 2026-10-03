import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { radiologyApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

type RadiologyOrderStatus = 'ordered' | 'in_progress' | 'completed' | 'cancelled';

interface RadiologyOrderItem {
  id: string;
  testName: string;
  category: string;
  unitPrice: number;
  resultText: string | null;
}

interface RadiologyOrder {
  id: string;
  radiologyOrderNumber: string;
  testName: string;
  status: RadiologyOrderStatus;
  orderedAt: string;
  completedAt: string | null;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string };
  items: RadiologyOrderItem[];
}

type QueueData = Record<RadiologyOrderStatus, RadiologyOrder[]>;

const STATUS_COLUMNS: { key: RadiologyOrderStatus; label: string; color: string; next?: RadiologyOrderStatus; nextLabel?: string }[] = [
  { key: 'ordered',     label: 'Ordered',     color: 'blue',   next: 'in_progress', nextLabel: 'Start scan' },
  { key: 'in_progress', label: 'In progress', color: 'purple', next: undefined,      nextLabel: undefined },
];

const COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function RadiologyQueuePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('radiology:update'));

  const { data, isLoading } = useQuery<QueueData>({
    queryKey: ['radiology-queue'],
    queryFn: () => radiologyApi.getQueue().then((r) => r.data),
    refetchInterval: 30000,
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RadiologyOrderStatus }) =>
      radiologyApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['radiology-queue'] }),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading queue…
      </div>
    );
  }

  const total = STATUS_COLUMNS.reduce((acc, col) => acc + (data?.[col.key]?.length ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Radiology queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} active order{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/radiology/completed')}
          className="text-sm text-blue-600 hover:underline"
        >
          View completed →
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const orders = data?.[col.key] ?? [];
          const c = COLOR[col.color];
          return (
            <div key={col.key} className="flex flex-col gap-3">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${c.bg}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={`text-sm font-medium ${c.text}`}>{col.label}</span>
                <span className={`ml-auto text-xs font-semibold ${c.text}`}>{orders.length}</span>
              </div>

              {orders.length === 0 && (
                <div className="text-center py-8 text-sm text-gray-400 border border-dashed border-gray-200 rounded-lg">
                  No orders
                </div>
              )}
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-gray-200 rounded-xl p-4 space-y-3 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-gray-500">
                      {order.radiologyOrderNumber}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {timeAgo(order.orderedAt)}
                    </span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {order.patient.firstName} {order.patient.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{order.patient.patientNumber}</p>
                  </div>

                  <p className="text-xs text-gray-600 leading-relaxed">{order.testName}</p>
                  <p className="text-xs text-gray-400">{order.items.length} stud{order.items.length !== 1 ? 'ies' : 'y'}</p>

                  <div className="flex gap-2 pt-1">
                    {canUpdate && col.next && (
                      <button
                        onClick={() => advanceMutation.mutate({ id: order.id, status: col.next! })}
                        disabled={advanceMutation.isPending}
                        className="flex-1 text-xs py-1.5 px-3 bg-gray-900 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
                      >
                        {col.nextLabel}
                      </button>
                    )}
                    {canUpdate && col.key === 'in_progress' && (
                      <button
                        onClick={() => navigate(`/radiology/${order.id}/result`)}
                        className="flex-1 text-xs py-1.5 px-3 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Enter findings
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/radiology/${order.id}/result`)}
                      className="text-xs py-1.5 px-3 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
                    >
                      View
                    </button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
