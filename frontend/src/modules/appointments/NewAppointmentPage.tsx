import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Search, Calendar, Clock, AlertTriangle } from 'lucide-react';
import { appointmentsApi, patientsApi, usersApi, departmentsApi } from '../../services/api';

const APPOINTMENT_TYPES = [
  'New visit', 'Follow-up', 'Check-up', 'Vaccination', 'Imaging',
  'Lab test', 'Consultation', 'Procedure', 'Emergency',
];

export function NewAppointmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [form, setForm] = useState({
    appointmentDate: new Date().toISOString().split('T')[0],
    appointmentTime: '09:00',
    department: '',
    appointmentType: '',
    doctorId: '',
    fee: '',
    notes: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Non-blocking "this patient may already be in progress" check — set once
  // the pre-check finds something, cleared whenever patient/doctor/department
  // changes so a stale warning never survives an edit.
  const [duplicateWarning, setDuplicateWarning] = useState<{
    type: 'appointment' | 'visit';
    status: string;
    doctorName?: string;
    department?: string;
    when: string;
  } | null>(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);

  const { data: patientResults } = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: () => patientsApi.search(patientSearch).then((r) => r.data),
    enabled: patientSearch.length >= 2,
  });

  const patients: any[] = patientResults?.data ?? patientResults ?? [];

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then((r) => r.data),
  });
  const departments: any[] = departmentsData ?? [];

  // The department <select> stores the department NAME (kept as-is, since that's
  // what gets submitted on the appointment), so look up its id separately to
  // filter doctors — the backend's /users/doctors endpoint filters by departmentId.
  const selectedDepartmentId = departments.find((d: any) => d.name === form.department)?.id;

  const { data: doctorsData } = useQuery({
    queryKey: ['users', 'doctors', selectedDepartmentId ?? 'all'],
    queryFn: () => usersApi.getDoctors(selectedDepartmentId).then((r) => r.data),
  });
  const doctors: any[] = doctorsData ?? [];

  const { mutate: create, isPending } = useMutation({
    mutationFn: (payload: any) => appointmentsApi.create(payload),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      navigate(`/appointments/${res.data?.id ?? res.data?.data?.id ?? ''}`.replace(/\/$/, '') || '/appointments/today');
    },
  });

  function validate() {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.patient = 'Select a patient';
    if (!form.appointmentDate) e.appointmentDate = 'Required';
    if (!form.appointmentTime) e.appointmentTime = 'Required';
    if (!form.department) e.department = 'Required';
    if (!form.appointmentType) e.appointmentType = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    // First press: check for a duplicate and, if found, stop and show the
    // banner instead of booking. Second press (after the warning is
    // showing) books anyway — the button label changes to make that clear.
    if (!duplicateWarning) {
      setCheckingDuplicate(true);
      try {
        const res = await appointmentsApi.checkDuplicate({
          patientId: selectedPatient.id,
          doctorId: form.doctorId || undefined,
          department: form.department || undefined,
        });
        if (res.data) {
          setDuplicateWarning(res.data);
          setCheckingDuplicate(false);
          return;
        }
      } catch {
        // If the check itself fails, don't block booking on it.
      }
      setCheckingDuplicate(false);
    }

    create({
      patientId: selectedPatient.id,
      ...form,
      fee: form.fee ? Number(form.fee) : 0,
    });
  }

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => { const n = { ...e }; delete n[field]; return n; });
  }

  // If the department changes and the currently-selected doctor doesn't belong
  // to it, clear the doctor selection rather than silently submitting a doctor
  // from a different department.
  useEffect(() => {
    if (form.doctorId && !doctors.some((d: any) => d.id === form.doctorId)) {
      setForm((f) => ({ ...f, doctorId: '' }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDepartmentId, doctors]);

  // Any change to who/where this appointment is for invalidates a
  // previously-shown duplicate warning — re-check on the next submit.
  useEffect(() => {
    setDuplicateWarning(null);
  }, [selectedPatient?.id, form.department, form.doctorId]);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-clinical-200 hover:bg-clinical-50 text-clinical-500"
        >
          <ChevronLeft size={16} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">New Appointment</h1>
          <p className="text-clinical-500 text-sm mt-0.5">Schedule an appointment for a patient</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 p-6 space-y-5">
        {/* Patient search */}
        <div>
          <label className="block text-sm font-medium text-clinical-700 mb-1">
            Patient <span className="text-red-500">*</span>
          </label>
          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-primary-300 bg-primary-50">
              <div>
                <p className="font-medium text-clinical-900">
                  {[selectedPatient.firstName, selectedPatient.middleName, selectedPatient.lastName].filter(Boolean).join(' ')}
                </p>
                <p className="text-xs text-clinical-500">{selectedPatient.patientNumber} · {selectedPatient.phone}</p>
              </div>
              <button
                onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                className="text-xs text-primary-600 hover:underline"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
              <input
                value={patientSearch}
                onChange={(e) => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }}
                onFocus={() => setShowPatientDropdown(true)}
                placeholder="Search by name, patient number, or phone..."
                className={`w-full pl-9 pr-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.patient ? 'border-red-400' : 'border-clinical-200'}`}
              />
              {showPatientDropdown && patients.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-clinical-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {patients.map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedPatient(p); setShowPatientDropdown(false); setErrors((e) => { const n = { ...e }; delete n.patient; return n; }); }}
                      className="w-full text-left px-4 py-2.5 hover:bg-clinical-50 border-b border-clinical-50 last:border-0"
                    >
                      <p className="text-sm font-medium text-clinical-900">
                        {[p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ')}
                      </p>
                      <p className="text-xs text-clinical-400">{p.patientNumber} · {p.phone}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {errors.patient && <p className="text-xs text-red-500 mt-1">{errors.patient}</p>}
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-clinical-700 mb-1">
              <Calendar size={13} className="inline mr-1" />
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={form.appointmentDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={(e) => set('appointmentDate', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.appointmentDate ? 'border-red-400' : 'border-clinical-200'}`}
            />
            {errors.appointmentDate && <p className="text-xs text-red-500 mt-1">{errors.appointmentDate}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-clinical-700 mb-1">
              <Clock size={13} className="inline mr-1" />
              Time <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={form.appointmentTime}
              onChange={(e) => set('appointmentTime', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.appointmentTime ? 'border-red-400' : 'border-clinical-200'}`}
            />
            {errors.appointmentTime && <p className="text-xs text-red-500 mt-1">{errors.appointmentTime}</p>}
          </div>
        </div>

        {/* Department & Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-clinical-700 mb-1">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              value={form.department}
              onChange={(e) => set('department', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.department ? 'border-red-400' : 'border-clinical-200'}`}
            >
              <option value="">Select department</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.name}>{d.name}</option>
              ))}
            </select>
            {errors.department && <p className="text-xs text-red-500 mt-1">{errors.department}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-clinical-700 mb-1">
              Appointment type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.appointmentType}
              onChange={(e) => set('appointmentType', e.target.value)}
              className={`w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 ${errors.appointmentType ? 'border-red-400' : 'border-clinical-200'}`}
            >
              <option value="">Select type</option>
              {APPOINTMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.appointmentType && <p className="text-xs text-red-500 mt-1">{errors.appointmentType}</p>}
          </div>
        </div>

        {/* Doctor & Fee */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-clinical-700 mb-1">Doctor / Provider</label>
            <select
              value={form.doctorId}
              onChange={(e) => set('doctorId', e.target.value)}
              disabled={!form.department}
              className="w-full px-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-clinical-50 disabled:text-clinical-400"
            >
              <option value="">
                {!form.department ? 'Select a department first' : doctors.length === 0 ? 'No doctors in this department' : 'Select doctor'}
              </option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>Dr. {d.firstName} {d.lastName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-clinical-700 mb-1">Fee</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.fee}
              onChange={(e) => set('fee', e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-clinical-700 mb-1">Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            placeholder="Additional notes or reason for visit..."
            rows={3}
            className="w-full px-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>

        {/* Duplicate warning */}
        {duplicateWarning && (
          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-yellow-300 bg-yellow-50 text-sm text-yellow-800">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">
                This patient already has {duplicateWarning.type === 'visit' ? 'an active visit' : 'a pending appointment'}
                {duplicateWarning.doctorName ? ` with Dr. ${duplicateWarning.doctorName}` : ''}
                {duplicateWarning.department ? ` in ${duplicateWarning.department}` : ''}.
              </p>
              <p className="text-yellow-700 mt-0.5">
                Status: {duplicateWarning.status.replace('_', ' ')} · {duplicateWarning.when}
              </p>
              <p className="text-yellow-700 mt-1">Click "Book Anyway" to continue, or Cancel to review.</p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-clinical-100">
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm border border-clinical-200 rounded-lg text-clinical-600 hover:bg-clinical-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isPending || checkingDuplicate}
            className={`px-5 py-2 text-sm rounded-lg font-medium disabled:opacity-60 ${
              duplicateWarning ? 'bg-yellow-600 text-white hover:opacity-90' : 'bg-primary-600 text-white hover:opacity-90'
            }`}
          >
            {checkingDuplicate
              ? 'Checking…'
              : isPending
              ? 'Scheduling...'
              : duplicateWarning
              ? 'Book Anyway'
              : 'Schedule appointment'}
          </button>
        </div>
      </div>
    </div>
  );
}
