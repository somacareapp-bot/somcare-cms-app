import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { radiologyApi } from '../../services/api';

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
  status: string;
  orderedAt: string;
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth?: string;
    gender?: string;
  };
  items: RadiologyOrderItem[];
}

function age(dob?: string) {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  return `${y}y`;
}

export function RadiologyResultEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery<RadiologyOrder>({
    queryKey: ['radiology-order', id],
    queryFn: () => radiologyApi.getOne(id!).then((r) => r.data),
    enabled: !!id,
  });

  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (order) {
      const init: Record<string, string> = {};
      order.items.forEach((item) => {
        init[item.id] = item.resultText ?? '';
      });
      setValues(init);
    }
  }, [order]);

  const setValue = (itemId: string, v: string) =>
    setValues((prev) => ({ ...prev, [itemId]: v }));

  const submitMutation = useMutation({
    mutationFn: () => {
      const items = order!.items
        .filter((item) => values[item.id]?.trim())
        .map((item) => ({ itemId: item.id, resultText: values[item.id].trim() }));
      if (items.length === 0) throw new Error('Enter at least one finding.');
      return radiologyApi.updateResult(order!.id, items);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['radiology-queue'] });
      qc.invalidateQueries({ queryKey: ['radiology-order', id] });
      navigate('/radiology');
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }
  if (isError || !order) {
    return <div className="p-6 text-red-600">Order not found.</div>;
  }

  const completed = order.status === 'completed';

  const groups = order.items.reduce<Record<string, RadiologyOrderItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const filledCount = order.items.filter((i) => values[i.id]?.trim()).length;
  const totalCount = order.items.length;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      <button
        onClick={() => navigate('/radiology')}
        className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
      >
        ← Back to queue
      </button>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
            {order.patient.firstName[0]}{order.patient.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-gray-900">
                {order.patient.firstName} {order.patient.lastName}
              </h1>
              <span className="text-xs font-mono text-gray-400">{order.patient.patientNumber}</span>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {[age(order.patient.dateOfBirth), order.patient.gender].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
            {order.radiologyOrderNumber}
          </span>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium
            ${completed
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-purple-50 text-purple-700 border border-purple-200'}`}>
            {completed ? 'Completed' : order.status.replace(/_/g, ' ')}
          </span>
          <span className="text-xs text-gray-400">
            Ordered {new Date(order.orderedAt).toLocaleDateString()}
          </span>
        </div>
      </div>

      {order.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Notes: </span>{order.notes}
        </div>
      )}

      {!completed && (
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-gray-900 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${totalCount ? (filledCount / totalCount) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 shrink-0">{filledCount}/{totalCount} filled</span>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groups).map(([category, items]) => (
          <div key={category} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-2 bg-gray-50 border-b border-gray-100">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{category}</span>
            </div>
            <div className="divide-y divide-gray-50">
              {items.map((item) => (
                <div key={item.id} className="px-5 py-4">
                  <p className="text-sm font-medium text-gray-900 mb-2">{item.testName}</p>
                  <textarea
                    rows={3}
                    value={values[item.id] ?? ''}
                    onChange={(e) => setValue(item.id, e.target.value)}
                    disabled={completed}
                    placeholder="Radiologist's findings / report…"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-60 disabled:cursor-not-allowed resize-none"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {submitMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {(submitMutation.error as Error).message || 'Failed to save findings. Try again.'}
        </div>
      )}

      {!completed && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => navigate('/radiology')}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || filledCount === 0}
            className="px-6 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitMutation.isPending ? 'Saving…' : 'Save findings'}
          </button>
        </div>
      )}

      {completed && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/radiology')}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Back to queue
          </button>
        </div>
      )}
    </div>
  );
}
