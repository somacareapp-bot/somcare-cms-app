import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, PackageCheck, XCircle } from 'lucide-react';
import { pharmacyApi } from '../../services/api';

interface PrescriptionRow {
  id: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  createdAt: string;
  visit: { visitNumber: string; patient: { firstName: string; lastName: string; patientNumber: string } };
}

interface Medicine {
  id: string;
  name: string;
  unit: string;
  stockQuantity: number;
  sellPrice: number;
}

export function DispensingPage() {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [medicineId, setMedicineId] = useState('');
  const [quantity, setQuantity] = useState('');

  const { data: pending, isLoading } = useQuery({
    queryKey: ['pharmacy', 'prescriptions', 'pending'],
    queryFn: async () => {
      const res = await pharmacyApi.getPrescriptions('pending');
      return res.data as PrescriptionRow[];
    },
    refetchInterval: 15000,
  });

  const { data: medicines } = useQuery({
    queryKey: ['pharmacy', 'medicines', 'all-active'],
    queryFn: async () => {
      const res = await pharmacyApi.getMedicines();
      return res.data as Medicine[];
    },
  });

  const dispenseMutation = useMutation({
    mutationFn: ({ id, medicineId, quantity }: { id: string; medicineId: string; quantity: number }) =>
      pharmacyApi.dispense(id, { medicineId, quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      closeForm();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => pharmacyApi.cancelPrescription(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pharmacy'] }),
  });

  function openForm(id: string) {
    setActiveId(id);
    setMedicineId('');
    setQuantity('');
  }

  function closeForm() {
    setActiveId(null);
    setMedicineId('');
    setQuantity('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
          <PackageCheck size={22} className="text-primary-600" /> Dispensing
        </h1>
        <p className="text-clinical-500 text-sm mt-1">Fulfil pending prescriptions and update stock.</p>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : !pending || pending.length === 0 ? (
          <p className="text-center text-clinical-400 text-sm py-16">No pending prescriptions — all caught up.</p>
        ) : (
          <div className="divide-y divide-clinical-50">
            {pending.map((p) => (
              <div key={p.id} className="p-4">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-clinical-900">{p.drugName}</p>
                    <p className="text-xs text-clinical-500 mt-0.5">
                      {p.visit.patient.firstName} {p.visit.patient.lastName} · {p.visit.patient.patientNumber} · {p.visit.visitNumber}
                    </p>
                    <p className="text-xs text-clinical-400 mt-0.5">
                      {[p.dose, p.frequency, p.duration].filter(Boolean).join(' · ') || 'No dosage details'}
                    </p>
                  </div>

                  {activeId === p.id ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <select
                        value={medicineId}
                        onChange={(e) => setMedicineId(e.target.value)}
                        className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500 min-w-[160px]"
                      >
                        <option value="">Select medicine…</option>
                        {(medicines ?? []).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} — ${Number(m.sellPrice).toFixed(2)} ({m.stockQuantity} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="Qty"
                        className="w-20 border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                      />
                      {medicineId && quantity && (
                        <span className="text-xs font-semibold text-clinical-700 bg-clinical-50 border border-clinical-200 rounded-lg px-2.5 py-2">
                          Total: $
                          {(
                            (medicines ?? []).find((m) => m.id === medicineId)?.sellPrice
                              ? Number((medicines ?? []).find((m) => m.id === medicineId)!.sellPrice) * Number(quantity)
                              : 0
                          ).toFixed(2)}
                        </span>
                      )}
                      <button
                        onClick={() => medicineId && quantity && dispenseMutation.mutate({ id: p.id, medicineId, quantity: Number(quantity) })}
                        disabled={!medicineId || !quantity || dispenseMutation.isPending}
                        className="text-xs font-semibold text-white bg-primary-600 rounded-lg px-3 py-2 hover:bg-primary-700 disabled:opacity-50"
                      >
                        {dispenseMutation.isPending ? 'Dispensing…' : 'Confirm Dispense'}
                      </button>
                      <button
                        onClick={closeForm}
                        className="text-xs font-semibold text-clinical-500 border border-clinical-200 rounded-lg px-3 py-2 hover:border-clinical-300"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openForm(p.id)}
                        className="flex items-center gap-1.5 text-xs font-semibold text-white bg-primary-600 rounded-lg px-3 py-2 hover:bg-primary-700"
                      >
                        <PackageCheck size={13} /> Dispense
                      </button>
                      <button
                        onClick={() => cancelMutation.mutate(p.id)}
                        disabled={cancelMutation.isPending}
                        className="flex items-center gap-1.5 text-xs font-semibold text-clinical-500 border border-clinical-200 rounded-lg px-3 py-2 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                      >
                        <XCircle size={13} /> Cancel Rx
                      </button>
                    </div>
                  )}
                </div>
                {dispenseMutation.isError && activeId === p.id && (
                  <p className="text-red-600 text-xs mt-2">
                    {(dispenseMutation.error as any)?.response?.data?.message ?? "Couldn't dispense this prescription."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
