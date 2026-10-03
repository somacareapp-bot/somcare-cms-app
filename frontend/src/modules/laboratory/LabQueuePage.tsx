import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { labApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

type LabOrderStatus = 'ordered' | 'sample_collected' | 'in_progress' | 'completed' | 'cancelled';

interface LabOrderItem {
  id: string;
  testName: string;
  category: string;
  unit: string;
  referenceRange: string;
  resultValue: string | null;
  flag: 'low' | 'high' | 'normal' | null;
}

interface LabOrder {
  id: string;
  labOrderNumber: string;
  testName: string;
  status: LabOrderStatus;
  orderedAt: string;
  sampleCollectedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  patient: { id: string; firstName: string; lastName: string; patientNumber: string };
  items: LabOrderItem[];
}

type QueueData = Record<LabOrderStatus, LabOrder[]>;

const STATUS_COLUMNS: { key: LabOrderStatus; label: string; color: string; next?: LabOrderStatus; nextLabel?: string }[] = [
  { key: 'ordered',          label: 'Ordered',          color: 'blue',   next: 'sample_collected', nextLabel: 'Collect sample' },
  { key: 'sample_collected', label: 'Sample collected',  color: 'amber',  next: 'in_progress',      nextLabel: 'Start analysis' },
  { key: 'in_progress',      label: 'In progress',       color: 'purple', next: undefined,           nextLabel: undefined },
];

const COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  amber:  { bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500' },
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

export function LabQueuePage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const canUpdate = useAuthStore((s) => s.hasPermission('laboratory:update'));

  const { data, isLoading } = useQuery<QueueData>({
    queryKey: ['lab-queue'],
    queryFn: () => labApi.getQueue().then((r) => r.data),
    refetchInterval: 30000,
  });

  const advanceMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: LabOrderStatus }) =>
      labApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lab-queue'] }),
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Laboratory queue</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} active order{total !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => navigate('/laboratory/completed')}
          className="text-sm text-blue-600 hover:underline"
        >
          View completed →
        </button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-3 gap-4">
        {STATUS_COLUMNS.map((col) => {
          const orders = data?.[col.key] ?? [];
          const c = COLOR[col.color];
          return (
            <div key={col.key} className="flex flex-col gap-3">
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${c.bg}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={`text-sm font-medium ${c.text}`}>{col.label}</span>
                <span className={`ml-auto text-xs font-semibold ${c.text}`}>{orders.length}</span>
              </div>

              {/* Cards */}
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
                  {/* Order number + time */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-mono font-semibold text-gray-500">
                      {order.labOrderNumber}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {timeAgo(order.orderedAt)}
                    </span>
                  </div>

                  {/* Patient */}
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {order.patient.firstName} {order.patient.lastName}
                    </p>
                    <p className="text-xs text-gray-500">{order.patient.patientNumber}</p>
                  </div>

                  {/* Tests */}
                  <p className="text-xs text-gray-600 leading-relaxed">{order.testName}</p>

                  {/* Item count */}
                  <p className="text-xs text-gray-400">{order.items.length} test{order.items.length !== 1 ? 's' : ''}</p>

                  {/* Actions */}
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
                        onClick={() => navigate(`/laboratory/${order.id}/result`)}
                        className="flex-1 text-xs py-1.5 px-3 bg-gray-900 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Enter results
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/laboratory/${order.id}/result`)}
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
