import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Loader2, Wifi } from 'lucide-react';
import { visitsApi } from '../../services/api';

interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  patientNumber: string;
  gender: string;
  dateOfBirth?: string;
}

interface Visit {
  id: string;
  visitNumber: string;
  status: 'waiting' | 'in_triage' | 'with_doctor' | 'ready_discharge' | 'completed' | 'cancelled';
  urgency: 'normal' | 'urgent' | 'emergency';
  department?: string;
  checkedInAt: string;
  patient: Patient;
  doctor?: { firstName: string; lastName: string; position?: string };
}

type QueueColumns = Record<string, Visit[]>;

// Registration/'waiting' column removed — receptionist check-in now
// creates the visit directly in Triage, so that stage is never populated.
//
// 'with_doctor' now fans out into in_lab / in_radiology / in_pharmacy on the
// backend (derived from open orders, not a stored status) and returns to
// 'with_doctor' once nothing is outstanding, so those three are plain
// display-only columns with no nextStatus button of their own.
const columnDefs: { key: string; title: string; nextStatus?: string; accent: string }[] = [
  { key: 'in_triage', title: 'Triage', nextStatus: 'with_doctor', accent: 'border-l-amber-400' },
  { key: 'with_doctor', title: 'Doctor', accent: 'border-l-purple-400' },
  { key: 'in_lab', title: 'Lab', accent: 'border-l-sky-400' },
  { key: 'in_radiology', title: 'Radiology', accent: 'border-l-indigo-400' },
  { key: 'in_pharmacy', title: 'Pharmacy', accent: 'border-l-emerald-400' },
  { key: 'completed', title: 'Completed', accent: 'border-l-green-400' },
];

// Any column where the card represents a patient mid-consultation — clicking
// it should always open the consultation view, whether they're sitting with
// the doctor or currently out at Lab/Radiology/Pharmacy.
const consultationKeys = ['with_doctor', 'in_lab', 'in_radiology', 'in_pharmacy'];

const urgencyBorder: Record<Visit['urgency'], string> = {
  normal: '',
  urgent: 'border-l-amber-500',
  emergency: 'border-l-red-600 bg-red-50',
};

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  return `${Math.round(mins / 60)}h ago`;
}

export function QueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['visits', 'queue'],
    queryFn: async () => {
      const res = await visitsApi.getQueue();
      return res.data as QueueColumns;
    },
    refetchInterval: 15000,
  });

  const moveMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => visitsApi.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits', 'queue'] }),
  });


  const columns = data ?? {};
  const nowServing = columns['with_doctor']?.[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <p className="text-xs font-semibold text-clinical-400 uppercase tracking-wide">Queue Management</p>
          <h1 className="text-2xl font-bold text-clinical-900 mt-0.5">Live Queue</h1>
          <p className="text-clinical-500 text-sm mt-1">Updates in real time across every PC on the network</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <Wifi size={14} /> Server Connected
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-clinical-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Loading queue…
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-4">
          Couldn't load the queue. Check that the backend is running.
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {/* Now Serving banner */}

          <div className="bg-clinical-900 rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="text-[11px] font-bold text-clinical-400 uppercase tracking-widest">Now Serving</p>
              <p className="text-4xl font-extrabold text-white mt-1">
                {nowServing ? nowServing.visitNumber : '—'}
              </p>
            </div>
            {nowServing ? (
              <div className="text-right text-sm">
                <p className="text-clinical-300">
                  Patient: <span className="font-semibold text-white">{nowServing.patient.firstName} {nowServing.patient.lastName}</span>
                </p>
                <p className="text-clinical-400 text-xs mt-0.5">
                    {nowServing.doctor ? `Dr. ${nowServing.doctor.firstName} ${nowServing.doctor.lastName}` : 'No doctor assigned'}
                  </p>
              </div>
            ) : (
              <p className="text-clinical-400 text-sm">No patient currently with a doctor</p>
            )}
          </div>

          {/* Columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            {columnDefs.map((col) => {
              const visits = columns[col.key] ?? [];
              return (
                <div key={col.key} className="bg-white rounded-xl border border-clinical-200 flex flex-col max-h-[560px]">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-clinical-200">
                    <span className="text-sm font-semibold text-clinical-800">{col.title}</span>
                    <span className="text-xs font-bold bg-clinical-100 text-clinical-500 px-2 py-0.5 rounded-full">
                      {visits.length}
                    </span>
                  </div>
                  <div className="p-2.5 overflow-y-auto flex-1 space-y-2">

                    {visits.map((v, i) => (
                      <div
                        key={v.id}
                        onClick={() => {
                          if (consultationKeys.includes(col.key)) navigate(`/clinical/consultation/${v.id}`);
                          if (col.key === 'in_triage') navigate(`/clinical/triage/${v.id}`);
                        }}
                        className={`relative rounded-lg p-3 pl-9 border-l-[3px] ${
                          col.key === 'completed' ? 'bg-green-50 border-l-green-400' : `bg-clinical-50 ${urgencyBorder[v.urgency] || col.accent}`
                        } ${
                          [...consultationKeys, 'in_triage'].includes(col.key)
                            ? 'cursor-pointer hover:bg-clinical-100/70'
                            : ''
                        } transition-colors`}
                      >
                        {/* Queue position within this column */}
                        <span
                          className="absolute left-2 top-2.5 flex items-center justify-center w-5 h-5 rounded-full bg-clinical-200 text-clinical-700 text-[10px] font-bold"
                          title={`Queue position ${i + 1}`}
                        >
                          {i + 1}
                        </span>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-semibold text-clinical-400">{v.visitNumber}</span>
                          {col.key === 'completed' ? (
                            <span className="text-[10px] font-bold text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">✓ Done</span>
                          ) : v.urgency === 'emergency' ? (
                            <span className="text-[10px] font-bold text-red-600 uppercase">Urgent</span>
                          ) : null}
                        </div>
                        <p className="text-sm font-semibold text-clinical-900 mt-1">
                          {v.patient.firstName} {v.patient.lastName}
                        </p>
                        <p className="text-xs text-clinical-500 mt-0.5">
                          {v.patient.patientNumber} · {timeAgo(v.checkedInAt)}
                        </p>
                        {v.doctor && (
                          <p className="text-[11px] text-primary-600 font-medium mt-0.5">
                            Dr. {v.doctor.firstName} {v.doctor.lastName}
                          </p>
                        )}
                        {/* Doctor column: Complete button — only while nothing is
                            outstanding at Lab/Radiology/Pharmacy (they get placed
                            back into with_doctor automatically once clear) */}
                        {col.key === 'with_doctor' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveMutation.mutate({ id: v.id, status: 'completed' });
                            }}
                            disabled={moveMutation.isPending}
                            className="mt-2 w-full flex items-center justify-center gap-1 text-[11px] font-semibold text-white bg-green-600 hover:bg-green-700 rounded-md py-1 disabled:opacity-50"
                          >
                            ✓ Complete Consultation
                          </button>
                        )}
                      </div>
                    ))}
                    {visits.length === 0 && (
                      <p className="text-xs text-clinical-400 text-center py-6">No patients in this stage.</p>
                    )}
                  </div>
                  {col.nextStatus && (

                    <button
                      disabled={visits.length === 0 || moveMutation.isPending}
                      onClick={() => visits[0] && moveMutation.mutate({ id: visits[0].id, status: col.nextStatus! })}
                      className="flex items-center justify-center gap-1.5 text-xs font-semibold text-primary-600 py-2.5 border-t border-clinical-200 hover:bg-clinical-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Move next patient
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
