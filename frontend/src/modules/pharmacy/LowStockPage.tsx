import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, AlertTriangle, PackagePlus } from 'lucide-react';
import { pharmacyApi } from '../../services/api';

interface Medicine {
  id: string;
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
}

export function LowStockPage() {
  const queryClient = useQueryClient();
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');

  const { data: medicines, isLoading } = useQuery({
    queryKey: ['pharmacy', 'medicines', 'low-stock'],
    queryFn: async () => {
      const res = await pharmacyApi.getLowStock();
      return res.data as Medicine[];
    },
    refetchInterval: 30000,
  });

  const restockMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => pharmacyApi.restockMedicine(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setRestockId(null);
      setRestockQty('');
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
          <AlertTriangle size={22} className="text-red-600" /> Low Stock
        </h1>
        <p className="text-clinical-500 text-sm mt-1">Medicines at or below their reorder level.</p>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : !medicines || medicines.length === 0 ? (
          <p className="text-center text-clinical-400 text-sm py-16">Stock levels look healthy — nothing needs restocking.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinical-100 bg-clinical-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Medicine</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Current Stock</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Reorder Level</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-50">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-clinical-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-clinical-900">{m.name}</td>
                  <td className="px-4 py-3 text-clinical-600 capitalize">{m.category}</td>
                  <td className="px-4 py-3">
                    <span className="text-red-600 font-bold">{m.stockQuantity} {m.unit}(s)</span>
                  </td>
                  <td className="px-4 py-3 text-clinical-500">{m.reorderLevel}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      {restockId === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={restockQty}
                            onChange={(e) => setRestockQty(e.target.value)}
                            placeholder="Qty"
                            autoFocus
                            className="w-20 border border-clinical-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary-500"
                          />
                          <button
                            onClick={() => restockQty && restockMutation.mutate({ id: m.id, quantity: Number(restockQty) })}
                            disabled={!restockQty || restockMutation.isPending}
                            className="text-xs font-semibold text-white bg-primary-600 rounded-lg px-2.5 py-1.5 hover:bg-primary-700 disabled:opacity-50"
                          >
                            {restockMutation.isPending ? 'Saving…' : 'Add'}
                          </button>
                          <button
                            onClick={() => { setRestockId(null); setRestockQty(''); }}
                            className="text-xs font-semibold text-clinical-500 border border-clinical-200 rounded-lg px-2.5 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRestockId(m.id); setRestockQty(''); }}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg px-2.5 py-1.5 hover:bg-primary-50"
                        >
                          <PackagePlus size={13} /> Restock
                        </button>
                      )}
                    </div>
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
