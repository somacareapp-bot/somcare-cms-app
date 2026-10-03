import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    dateOfBirth?: string;
    gender?: string;
    bloodGroup?: string;
  };
  items: LabOrderItem[];
}

// ── Flag computation (mirrors backend logic) ────────────────────────────────
function computeFlag(value: string, referenceRange: string | null): Flag {
  if (!referenceRange || value.trim() === '') return null;
  const numeric = parseFloat(value);
  if (Number.isNaN(numeric)) return null;

  const rangeMatch = referenceRange.match(/^([\d.]+)\s*-\s*([\d.]+)/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    if (numeric < lo) return 'low';
    if (numeric > hi) return 'high';
    return 'normal';
  }
  const ltMatch = referenceRange.match(/^<\s*([\d.]+)/);
  if (ltMatch) return numeric > parseFloat(ltMatch[1]) ? 'high' : 'normal';

  const gtMatch = referenceRange.match(/^>\s*([\d.]+)/);
  if (gtMatch) return numeric < parseFloat(gtMatch[1]) ? 'low' : 'normal';

  return null;
}

// ── Flag badge ───────────────────────────────────────────────────────────────
function FlagBadge({ flag }: { flag: Flag }) {
  if (!flag) return <span className="text-gray-300 text-sm">—</span>;
  const styles: Record<string, string> = {
    high:   'bg-red-50 text-red-700 border border-red-200',
    low:    'bg-amber-50 text-amber-700 border border-amber-200',
    normal: 'bg-green-50 text-green-700 border border-green-200',
  };
  const labels: Record<string, string> = { high: 'H', low: 'L', normal: 'N' };
  return (
    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${styles[flag]}`}>
      {labels[flag]}
    </span>
  );
}

// ── Result input cell ────────────────────────────────────────────────────────
function ResultInput({
  value,
  flag,
  onChange,
  completed,
}: {
  value: string;
  flag: Flag;
  onChange: (v: string) => void;
  completed: boolean;
}) {
  const borderColor =
    flag === 'high' ? 'border-red-300 focus:ring-red-200' :
    flag === 'low'  ? 'border-amber-300 focus:ring-amber-200' :
    flag === 'normal' ? 'border-green-300 focus:ring-green-200' :
    'border-gray-200 focus:ring-blue-100';

  const bgColor =
    flag === 'high'   ? 'bg-red-50' :
    flag === 'low'    ? 'bg-amber-50' :
    flag === 'normal' ? 'bg-green-50' :
    'bg-white';

  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={completed}
      placeholder="—"
      className={`w-32 px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors
        ${borderColor} ${bgColor}
        disabled:opacity-60 disabled:cursor-not-allowed`}
    />
  );
}

// ── Age helper ───────────────────────────────────────────────────────────────
function age(dob?: string) {
  if (!dob) return null;
  const y = Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000);
  return `${y}y`;
}

// ── Main page ────────────────────────────────────────────────────────────────
export function LabResultEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: order, isLoading, isError } = useQuery<LabOrder>({
    queryKey: ['lab-order', id],
    queryFn: () => labApi.getOne(id!).then((r) => r.data),
    enabled: !!id,
  });

  // Local state: map of itemId → current text value
  const [values, setValues] = useState<Record<string, string>>({});

  // Seed from existing result values when order loads
  useEffect(() => {
    if (order) {
      const init: Record<string, string> = {};
      order.items.forEach((item) => {
        init[item.id] = item.resultValue ?? '';
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
        .map((item) => ({ itemId: item.id, resultValue: values[item.id].trim() }));
      if (items.length === 0) throw new Error('Enter at least one result value.');
      return labApi.updateResult(order!.id, items);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lab-queue'] });
      qc.invalidateQueries({ queryKey: ['lab-order', id] });
      navigate('/laboratory');
    },
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>;
  }
  if (isError || !order) {
    return <div className="p-6 text-red-600">Order not found.</div>;
  }

  const completed = order.status === 'completed';

  // Group items by category
  const groups = order.items.reduce<Record<string, LabOrderItem[]>>((acc, item) => {
    const cat = item.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const filledCount = order.items.filter((i) => values[i.id]?.trim()).length;
  const totalCount = order.items.length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">

      {/* Back */}
      <button
        onClick={() => navigate('/laboratory')}
        className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1"
      >
        ← Back to queue
      </button>

      {/* Order header card */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Patient avatar */}
          <div className="w-12 h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-semibold text-sm shrink-0">
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
              {[age(order.patient.dateOfBirth), order.patient.gender, order.patient.bloodGroup]
                .filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <span className="text-xs font-mono font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded-lg">
            {order.labOrderNumber}
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

      {/* Notes */}
      {order.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <span className="font-medium">Notes: </span>{order.notes}
        </div>
      )}

      {/* Progress bar (only when not completed) */}
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

      {/* Results table — grouped by category */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Test results</h2>
          <p className="text-xs text-gray-400">Reference ranges are from Settings → Laboratory</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Test</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Unit</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Reference range</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Result</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wide">Flag</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(groups).map(([category, items]) => (
              <React.Fragment key={category}>
                {/* Category sub-header */}
                <tr className="bg-gray-50">
                  <td colSpan={5} className="px-5 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {category}
                  </td>
                </tr>

                {items.map((item, idx) => {
                  const currentValue = values[item.id] ?? '';
                  const liveFlag = computeFlag(currentValue, item.referenceRange);

                  return (
                    <tr
                      key={item.id}
                      className={`border-t border-gray-50 hover:bg-gray-50/50 transition-colors
                        ${idx === items.length - 1 ? 'border-b border-gray-100' : ''}`}
                    >
                      <td className="px-5 py-3 font-medium text-gray-900">{item.testName}</td>
                      <td className="px-4 py-3 text-gray-500">{item.unit || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                        {item.referenceRange || <span className="text-gray-300">not set</span>}
                      </td>
                      <td className="px-4 py-3">
                        <ResultInput
                          value={currentValue}
                          flag={liveFlag}
                          onChange={(v) => setValue(item.id, v)}
                          completed={completed}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <FlagBadge flag={liveFlag} />
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Flag legend */}
      <div className="flex items-center gap-5 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-50 text-red-700 border border-red-200 text-xs font-bold">H</span>
          Above range
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">L</span>
          Below range
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-50 text-green-700 border border-green-200 text-xs font-bold">N</span>
          Within range
        </span>
      </div>

      {/* Error */}
      {submitMutation.isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          {(submitMutation.error as Error).message || 'Failed to save results. Try again.'}
        </div>
      )}

      {/* Footer actions */}
      {!completed && (
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={() => navigate('/laboratory')}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => submitMutation.mutate()}
            disabled={submitMutation.isPending || filledCount === 0}
            className="px-6 py-2 text-sm bg-gray-900 text-white rounded-xl hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {submitMutation.isPending ? 'Saving…' : 'Save results'}
          </button>
        </div>
      )}

      {completed && (
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/laboratory')}
            className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Back to queue
          </button>
        </div>
      )}
    </div>
  );
}
