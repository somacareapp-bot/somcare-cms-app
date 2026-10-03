import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { visitsApi } from '../../services/api';

interface Visit {
  id: string;
  visitNumber: string;
  status: string;
  urgency: 'normal' | 'urgent' | 'emergency';
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  spo2?: string;
  checkedInAt?: string;
  patient: {
    firstName: string;
    lastName: string;
    patientNumber: string;
    gender: string;
    dateOfBirth?: string;
    allergies?: string;
  };
}

export function TriagePage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['visits', visitId],
    queryFn: async () => {
      const res = await visitsApi.getOne(visitId!);
      return res.data as Visit;
    },
    enabled: !!visitId,
  });

  const [form, setForm] = useState({
    bloodPressure: '',
    heartRate: '',
    temperature: '',
    spo2: '',
  });
  const [initialized, setInitialized] = useState(false);
  if (visit && !initialized) {
    setForm({
      bloodPressure: visit.bloodPressure ?? '',
      heartRate: visit.heartRate ?? '',
      temperature: visit.temperature ?? '',
      spo2: visit.spo2 ?? '',
    });
    setInitialized(true);
  }

  const saveVitalsMutation = useMutation({
    mutationFn: () => visitsApi.updateVitals(visitId!, form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits', visitId] }),
  });

  // Records vitals, then moves the visit to with_doctor so it appears
  // in the doctor's queue column.
  const sendToDoctorMutation = useMutation({
    mutationFn: async () => {
      await visitsApi.updateVitals(visitId!, form);
      await visitsApi.updateStatus(visitId!, 'with_doctor');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'queue'] });
      navigate('/queue/current');
    },
  });

  if (!visitId) {
    return (
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center text-clinical-400 text-sm">
        Select a patient from the Queue to begin triage.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-clinical-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading visit…
      </div>
    );
  }

  if (isError || !visit) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-4">
        Couldn't load this visit.
      </div>
    );
  }

  const allergyList = (visit.patient.allergies ?? '').split(',').map((a) => a.trim()).filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-clinical-400">
          Queue / {visit.patient.firstName} {visit.patient.lastName} / Triage
        </p>
        <h1 className="text-2xl font-bold text-clinical-900 mt-1">Triage</h1>
        <p className="text-clinical-500 text-sm mt-1">{visit.visitNumber}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-0 bg-white border border-clinical-200 rounded-xl overflow-hidden">
        {/* Left: patient panel */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-clinical-200">
          <div className="text-center pb-4 border-b border-clinical-200 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-2">
              {visit.patient.firstName[0]}{visit.patient.lastName[0]}
            </div>
            <p className="font-bold text-sm text-clinical-900">
              {visit.patient.firstName} {visit.patient.lastName}
            </p>
            <p className="text-xs text-clinical-400 mt-0.5">{visit.patient.patientNumber}</p>
          </div>

          {visit.urgency === 'emergency' && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-xs font-bold rounded-lg px-3 py-2 mb-4 text-center uppercase">
              Emergency
            </div>
          )}

          {allergyList.length > 0 && (
            <>
              <h4 className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-2">Allergies</h4>
              <div>
                {allergyList.map((a) => (
                  <span
                    key={a}
                    className="inline-flex bg-red-50 text-red-600 text-[11px] font-semibold px-2 py-1 rounded-md mr-1 mb-1"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Right: vitals form */}
        <div className="p-5">
          <h4 className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-4">Record Vitals</h4>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs font-bold text-clinical-800 mb-1.5">Blood Pressure</label>
              <input
                value={form.bloodPressure}
                onChange={(e) => setForm({ ...form, bloodPressure: e.target.value })}
                placeholder="e.g. 120/80"
                className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-clinical-800 mb-1.5">Heart Rate</label>
              <input
                value={form.heartRate}
                onChange={(e) => setForm({ ...form, heartRate: e.target.value })}
                placeholder="e.g. 78 bpm"
                className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-clinical-800 mb-1.5">Temperature</label>
              <input
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
                placeholder="e.g. 37.0°C"
                className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-clinical-800 mb-1.5">SpO2</label>
              <input
                value={form.spo2}
                onChange={(e) => setForm({ ...form, spo2: e.target.value })}
                placeholder="e.g. 98%"
                className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => saveVitalsMutation.mutate()}
              disabled={saveVitalsMutation.isPending}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-clinical-200 text-clinical-600 hover:border-clinical-300 disabled:opacity-50"
            >
              {saveVitalsMutation.isPending ? 'Saving…' : 'Save Vitals'}
            </button>
            <button
              onClick={() => sendToDoctorMutation.mutate()}
              disabled={sendToDoctorMutation.isPending}
              className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {sendToDoctorMutation.isPending ? 'Sending…' : 'Send to Doctor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
