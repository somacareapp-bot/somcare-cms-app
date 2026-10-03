import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2, X, Stethoscope, FlaskConical, Pill, Scan } from 'lucide-react';
import { visitsApi, labApi, labTestCatalogApi, pharmacyApi, radiologyApi, radiologyTestCatalogApi } from '../../services/api';
import { useAuthStore } from '../../stores/auth.store';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiagnosisCode {
  code: string;
  description: string;
  type: 'primary' | 'secondary' | 'complication' | 'co-morbidity';
}

interface Prescription {
  id: string;
  drugName: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  status?: 'pending' | 'dispensed' | 'cancelled';
}

interface LabOrder {
  id: string;
  labOrderNumber: string;
  testName: string;
  status: string;
}

interface LabTest {
  id: string;
  name: string;
  category?: string;
  isPanel?: boolean;
  panelId?: string | null;
}

interface RadiologyOrder {
  id: string;
  radiologyOrderNumber: string;
  testName: string;
  status: string;
}

interface RadiologyTest {
  id: string;
  name: string;
  category?: string;
}

interface QueueVisit {
  id: string;
  doctorId?: string;
  visitNumber: string;
  patient: { firstName: string; lastName: string; patientNumber: string };
}

interface Visit {
  id: string;
  visitNumber: string;
  status: string;
  bloodPressure?: string;
  heartRate?: string;
  temperature?: string;
  spo2?: string;
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  examinationFindings?: string;
  diagnosis?: string;
  diagnosisCodes?: DiagnosisCode[];
  checkedInAt?: string;
  triageStartedAt?: string;
  vitalsRecordedAt?: string;
  consultationStartedAt?: string;
  completedAt?: string;
  prescriptions: Prescription[];
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientNumber: string;
    gender: string;
    dateOfBirth?: string;
    bloodGroup?: string;
    phone?: string;
    allergies?: string;
  };
}

// ─── ICD-10 local search index ────────────────────────────────────────────────
// Extend this list or replace with an API call to a full ICD-10 service.

const ICD10_INDEX = [
  { code: 'J02.9',  desc: 'Acute pharyngitis, unspecified' },
  { code: 'J02.0',  desc: 'Streptococcal pharyngitis' },
  { code: 'J02.8',  desc: 'Acute pharyngitis due to other specified organisms' },
  { code: 'J00',    desc: 'Acute nasopharyngitis (common cold)' },
  { code: 'J06.9',  desc: 'Acute upper respiratory infection, unspecified' },
  { code: 'J03.90', desc: 'Acute tonsillitis, unspecified' },
  { code: 'J04.0',  desc: 'Acute laryngitis' },
  { code: 'J04.1',  desc: 'Acute tracheitis' },
  { code: 'J18.9',  desc: 'Pneumonia, unspecified organism' },
  { code: 'J45.909',desc: 'Unspecified asthma, uncomplicated' },
  { code: 'R05',    desc: 'Cough' },
  { code: 'R07.0',  desc: 'Pain in throat' },
  { code: 'R50.9',  desc: 'Fever, unspecified' },
  { code: 'R51',    desc: 'Headache' },
  { code: 'R10.9',  desc: 'Unspecified abdominal pain' },
  { code: 'R11.2',  desc: 'Nausea with vomiting, unspecified' },
  { code: 'R03.0',  desc: 'Elevated blood-pressure reading' },
  { code: 'I10',    desc: 'Essential (primary) hypertension' },
  { code: 'I11.9',  desc: 'Hypertensive heart disease without heart failure' },
  { code: 'E11.9',  desc: 'Type 2 diabetes mellitus without complications' },
  { code: 'E11.65', desc: 'Type 2 diabetes mellitus with hyperglycemia' },
  { code: 'E10.9',  desc: 'Type 1 diabetes mellitus without complications' },
  { code: 'B34.9',  desc: 'Viral infection, unspecified' },
  { code: 'A09',    desc: 'Other and unspecified gastroenteritis and colitis' },
  { code: 'A15.0',  desc: 'Tuberculosis of lung' },
  { code: 'B50.9',  desc: 'Plasmodium falciparum malaria, unspecified (malaria)' },
  { code: 'K21.0',  desc: 'Gastro-oesophageal reflux with oesophagitis' },
  { code: 'K29.70', desc: 'Gastritis, unspecified, without bleeding' },
  { code: 'M79.3',  desc: 'Panniculitis, unspecified' },
  { code: 'M54.5',  desc: 'Low back pain' },
  { code: 'Z87.39', desc: 'Personal history of other conditions' },
  { code: 'Z00.00', desc: 'Encounter for general adult medical examination' },
];

function searchICD10(query: string) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  return ICD10_INDEX.filter(
    (item) =>
      item.code.toLowerCase().includes(q) ||
      item.desc.toLowerCase().includes(q),
  ).slice(0, 7);
}

// ─── Sub-component: single diagnosis code row ─────────────────────────────────

interface DxRowProps {
  row: DiagnosisCode;
  index: number;
  onChange: (updated: DiagnosisCode) => void;
  onRemove: () => void;
}

function DxRow({ row, index, onChange, onRemove }: DxRowProps) {
  const [codeQuery, setCodeQuery] = useState(row.code);
  const [descQuery, setDescQuery] = useState(row.description);
  const [suggestions, setSuggestions] = useState<typeof ICD10_INDEX>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  const selectSuggestion = (item: (typeof ICD10_INDEX)[0]) => {
    setCodeQuery(item.code);
    setDescQuery(item.desc);
    setSuggestions([]);
    setShowDropdown(false);
    onChange({ ...row, code: item.code, description: item.desc });
  };

  const handleCodeChange = (val: string) => {
    setCodeQuery(val);
    onChange({ ...row, code: val });
    const results = searchICD10(val);
    setSuggestions(results);
    setShowDropdown(results.length > 0);
  };

  const handleDescChange = (val: string) => {
    setDescQuery(val);
    onChange({ ...row, description: val });
    const results = searchICD10(val);
    setSuggestions(results);
    setShowDropdown(results.length > 0);
  };

  const typeBadgeClass =
    row.type === 'primary'       ? 'bg-primary-50 text-primary-700 border-primary-200' :
    row.type === 'secondary'     ? 'bg-blue-50 text-blue-700 border-blue-200' :
    row.type === 'complication'  ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                   'bg-gray-100 text-gray-600 border-gray-200';

  return (
    <div className="relative">
      <div className={`flex gap-2 items-start p-2.5 rounded-lg border ${index === 0 ? 'border-primary-200 bg-primary-50/30' : 'border-clinical-100 bg-clinical-50/40'}`}>
        {/* Code input */}
        <div className="relative" style={{ width: '120px', flexShrink: 0 }}>
          <input
            ref={codeRef}
            value={codeQuery}
            onChange={(e) => handleCodeChange(e.target.value)}
            onFocus={() => { const r = searchICD10(codeQuery); setSuggestions(r); setShowDropdown(r.length > 0); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
            placeholder={index === 0 ? 'Primary code' : 'ICD-10 code'}
            className={`w-full border rounded-md px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-primary-500 ${index === 0 ? 'border-primary-300 bg-white font-semibold' : 'border-clinical-200 bg-white'}`}
          />
        </div>

        {/* Description input */}
        <div className="relative flex-1 min-w-0">
          <input
            value={descQuery}
            onChange={(e) => handleDescChange(e.target.value)}
            onFocus={() => { const r = searchICD10(descQuery); setSuggestions(r); setShowDropdown(r.length > 0); }}
            onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
            placeholder="Diagnosis description"
            className="w-full border border-clinical-200 rounded-md px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:border-primary-500"
          />
        </div>

        {/* Type selector */}
        <select
          value={row.type}
          onChange={(e) => onChange({ ...row, type: e.target.value as DiagnosisCode['type'] })}
          className={`border rounded-md px-2 py-1.5 text-xs focus:outline-none focus:border-primary-500 ${typeBadgeClass}`}
          style={{ width: '110px', flexShrink: 0 }}
        >
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="complication">Complication</option>
          <option value="co-morbidity">Co-morbidity</option>
        </select>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="w-7 h-7 rounded-md border border-clinical-200 text-clinical-400 hover:border-red-300 hover:text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5"
          aria-label="Remove diagnosis code"
        >
          <X size={12} />
        </button>
      </div>

      {/* ICD-10 autocomplete dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-40 left-0 right-8 top-full mt-1 bg-white border border-clinical-200 rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((item) => (
            <button
              key={item.code}
              type="button"
              onMouseDown={() => selectSuggestion(item)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-primary-50 border-b border-clinical-50 last:border-0 flex gap-3 items-baseline"
            >
              <span className="font-mono font-semibold text-primary-700 flex-shrink-0">{item.code}</span>
              <span className="text-clinical-600 truncate">{item.desc}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab bar config ────────────────────────────────────────────────────────────

type TabKey = 'consultation' | 'lab' | 'prescriptions' | 'radiology';

// ─── Main component ───────────────────────────────────────────────────────────

export function ConsultationPage() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<TabKey>('consultation');

  // Landing on /clinical/consultation with no :visitId (e.g. from the sidebar):
  // look up whether this user already has a patient WITH_DOCTOR in the queue
  // and jump straight to it, instead of showing an empty placeholder.
  const { data: myActiveVisits } = useQuery({
    queryKey: ['visits', 'queue', 'my-active'],
    queryFn: async () => {
      const res = await visitsApi.getQueue();
      const withDoctor: QueueVisit[] = res.data?.with_doctor ?? [];
      if (!currentUser) return [];
      return withDoctor;
    },
    enabled: !visitId && !!currentUser,
  });

  useEffect(() => {
    if (!visitId && myActiveVisits && myActiveVisits.length === 1) {
      navigate(`/clinical/consultation/${myActiveVisits[0].id}`, { replace: true });
    }
  }, [visitId, myActiveVisits, navigate]);

  const { data: visit, isLoading, isError } = useQuery({
    queryKey: ['visits', visitId],
    queryFn: async () => {
      const res = await visitsApi.getOne(visitId!);
      return res.data as Visit;
    },
    enabled: !!visitId,
  });

  const [form, setForm] = useState({
    chiefComplaint: '',
    historyOfPresentIllness: '',
    examinationFindings: '',
    diagnosis: '',
  });

  // Diagnosis codes state — separate from the free-text diagnosis field
  const [diagnosisCodes, setDiagnosisCodes] = useState<DiagnosisCode[]>([]);

  const [rxDraft, setRxDraft] = useState({ drugName: '', dose: '', frequency: '', duration: '' });
  const [rxMedicineSearch, setRxMedicineSearch] = useState('');
  const [rxShowDropdown, setRxShowDropdown] = useState(false);
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [selectedRadiologyTestIds, setSelectedRadiologyTestIds] = useState<string[]>([]);

  // Sync form once visit loads
  const [initialized, setInitialized] = useState(false);
  if (visit && !initialized) {
    setForm({
      chiefComplaint: visit.chiefComplaint ?? '',
      historyOfPresentIllness: visit.historyOfPresentIllness ?? '',
      examinationFindings: visit.examinationFindings ?? '',
      diagnosis: visit.diagnosis ?? '',
    });
    // Restore saved codes if backend persists them; otherwise start empty
    if (visit.diagnosisCodes && visit.diagnosisCodes.length > 0) {
      setDiagnosisCodes(visit.diagnosisCodes);
    }
    setInitialized(true);
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: () =>
      visitsApi.updateConsultation(visitId!, { ...form, diagnosisCodes }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits', visitId] }),
  });

  // Auto-save ~1s after typing stops
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!initialized || !visitId) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      visitsApi.updateConsultation(visitId, { ...form, diagnosisCodes }).then(() => {
        queryClient.invalidateQueries({ queryKey: ['visits', visitId] });
      });
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [
    form.chiefComplaint,
    form.historyOfPresentIllness,
    form.examinationFindings,
    form.diagnosis,
    diagnosisCodes,
    initialized,
    visitId,
  ]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      await visitsApi.updateConsultation(visitId!, { ...form, diagnosisCodes });
      await visitsApi.complete(visitId!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'queue'] });
      navigate('/queue/current');
    },
  });

  const addRxMutation = useMutation({
    mutationFn: () => visitsApi.addPrescription(visitId!, rxDraft),
    onSuccess: () => {
      setRxDraft({ drugName: '', dose: '', frequency: '', duration: '' });
      setRxMedicineSearch('');
      queryClient.invalidateQueries({ queryKey: ['visits', visitId] });
    },
  });

  const removeRxMutation = useMutation({
    mutationFn: (prescriptionId: string) =>
      visitsApi.removePrescription(visitId!, prescriptionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['visits', visitId] }),
  });

  const orderLabMutation = useMutation({
    mutationFn: () =>
      labApi.create({ visitId: visitId!, patientId: visit!.patient.id, testIds: selectedTestIds }),
    onSuccess: () => {
      setSelectedTestIds([]);
      queryClient.invalidateQueries({ queryKey: ['laboratory', 'by-visit', visitId] });
    },
  });

  const orderRadiologyMutation = useMutation({
    mutationFn: () =>
      radiologyApi.create({ visitId: visitId!, patientId: visit!.patient.id, testIds: selectedRadiologyTestIds }),
    onSuccess: () => {
      setSelectedRadiologyTestIds([]);
      queryClient.invalidateQueries({ queryKey: ['radiology', 'by-visit', visitId] });
    },
  });

  // ── Secondary queries ──────────────────────────────────────────────────────

  const { data: labOrders = [] } = useQuery({
    queryKey: ['laboratory', 'by-visit', visitId],
    queryFn: async () => {
      const res = await labApi.getByVisit(visitId!);
      return res.data as LabOrder[];
    },
    enabled: !!visitId,
  });

  const { data: labTests = [] } = useQuery({
    queryKey: ['labTestCatalog', 'orderable'],
    queryFn: async () => {
      const res = await labTestCatalogApi.getAll();
      return (res.data as LabTest[]).filter((t) => !t.panelId);
    },
  });

  const { data: radiologyOrders = [] } = useQuery({
    queryKey: ['radiology', 'by-visit', visitId],
    queryFn: async () => {
      const res = await radiologyApi.getByVisit(visitId!);
      return res.data as RadiologyOrder[];
    },
    enabled: !!visitId,
  });

  const { data: radiologyTests = [] } = useQuery({
    queryKey: ['radiologyTestCatalog', 'orderable'],
    queryFn: async () => {
      const res = await radiologyTestCatalogApi.getAll();
      return res.data as RadiologyTest[];
    },
  });

  const { data: medicines = [] } = useQuery({
    queryKey: ['pharmacy', 'medicines', 'consultation'],
    queryFn: async () => {
      const res = await pharmacyApi.getMedicines();
      return res.data as { id: string; name: string; unit: string; genericName?: string }[];
    },
  });

  // ── Diagnosis code helpers ─────────────────────────────────────────────────

  const addDxCode = () => {
    setDiagnosisCodes((prev) => [
      ...prev,
      { code: '', description: '', type: prev.length === 0 ? 'primary' : 'secondary' },
    ]);
  };

  const updateDxCode = (index: number, updated: DiagnosisCode) => {
    setDiagnosisCodes((prev) => prev.map((r, i) => (i === index ? updated : r)));
  };

  const removeDxCode = (index: number) => {
    setDiagnosisCodes((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Ensure the first remaining row is always typed as primary
      if (next.length > 0 && next[0].type !== 'primary') {
        next[0] = { ...next[0], type: 'primary' };
      }
      return next;
    });
  };

  // ── Early returns ──────────────────────────────────────────────────────────

  if (!visitId) {
    if (myActiveVisits && myActiveVisits.length > 1) {
      return (
        <div className="bg-white rounded-xl border border-clinical-200 p-6">
          <p className="text-sm font-semibold text-clinical-800 mb-3">
            You have multiple patients in consultation — choose one:
          </p>
          <div className="space-y-2">
            {myActiveVisits.map((v) => (
              <button
                key={v.id}
                onClick={() => navigate(`/clinical/consultation/${v.id}`)}
                className="w-full text-left px-4 py-3 rounded-lg border border-clinical-200 hover:border-primary-400 hover:bg-clinical-50 text-sm"
              >
                <span className="font-medium text-clinical-900">
                  {v.patient.firstName} {v.patient.lastName}
                </span>
                <span className="text-clinical-400 ml-2">
                  {v.visitNumber} · {v.patient.patientNumber}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="bg-white rounded-xl border border-clinical-200 p-10 text-center text-clinical-400 text-sm">
        Select a patient from the Queue to start a consultation.
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

  // ── Derived values ─────────────────────────────────────────────────────────

  const age = visit.patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(visit.patient.dateOfBirth).getTime()) / 3.15576e10)
    : null;

  const allergyList = (visit.patient.allergies ?? '')
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);

  const timeline = [
    { title: 'Registered patient',    date: visit.checkedInAt },
    { title: 'Triage completed',      date: visit.triageStartedAt },
    { title: 'Vitals recorded',       date: visit.vitalsRecordedAt },
    { title: 'Consultation started',  date: visit.consultationStartedAt },
    { title: 'Consultation completed', date: visit.completedAt },
  ].filter((t) => t.date);

  // Primary ICD-10 code chips for the summary bar
  const filledCodes = diagnosisCodes.filter((d) => d.code || d.description);

  const TABS: { key: TabKey; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'consultation', label: 'Consultation', icon: Stethoscope },
    { key: 'lab',           label: 'Lab',           icon: FlaskConical, badge: labOrders.length },
    { key: 'prescriptions', label: 'Prescriptions', icon: Pill,         badge: visit.prescriptions.length },
    { key: 'radiology',     label: 'Radiology',     icon: Scan,         badge: radiologyOrders.length },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-clinical-400">
          Patients / {visit.patient.firstName} {visit.patient.lastName} / Consultation
        </p>
        <h1 className="text-2xl font-bold text-clinical-900 mt-1">Consultation</h1>
        <p className="text-clinical-500 text-sm mt-1">{visit.visitNumber} · Outpatient</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-0 bg-white border border-clinical-200 rounded-xl overflow-hidden">

        {/* ── Left: patient panel (pinned across all tabs) ────────────────────── */}
        <div className="p-5 border-b lg:border-b-0 lg:border-r border-clinical-200 overflow-y-auto max-h-[820px]">
          <div className="text-center pb-4 border-b border-clinical-200 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-2">
              {visit.patient.firstName[0]}{visit.patient.lastName[0]}
            </div>
            <p className="font-bold text-sm text-clinical-900">
              {visit.patient.firstName} {visit.patient.lastName}
            </p>
            <p className="text-xs text-clinical-400 mt-0.5">{visit.patient.patientNumber}</p>
          </div>

          <h4 className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-3">Patient Info</h4>
          <div className="space-y-2.5 mb-5 text-xs">
            <div className="flex justify-between">
              <span className="text-clinical-400">Age / Sex</span>
              <span className="font-semibold text-clinical-800">
                {age ? `${age}y` : '—'} · {visit.patient.gender}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-400">Blood Group</span>
              <span className="font-semibold text-clinical-800">{visit.patient.bloodGroup ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-400">Phone</span>
              <span className="font-semibold text-clinical-800">{visit.patient.phone ?? '—'}</span>
            </div>
          </div>

          {allergyList.length > 0 && (
            <>
              <h4 className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-2">Allergies</h4>
              <div className="mb-5">
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

          <h4 className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-2">Vitals</h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Blood Pressure', visit.bloodPressure],
              ['Heart Rate',     visit.heartRate],
              ['Temperature',    visit.temperature],
              ['SpO2',           visit.spo2],
            ].map(([label, val]) => (
              <div key={label} className="bg-clinical-50 rounded-lg p-2.5">
                <p className="text-[10px] font-semibold text-clinical-400">{label}</p>
                <p className="text-sm font-bold text-clinical-900 mt-0.5">{val ?? '—'}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Middle: tab bar + tab content ────────────────────────────────────── */}
        <div className="border-b lg:border-b-0 lg:border-r border-clinical-200 overflow-y-auto max-h-[820px]">
          {/* Tab bar — styled like the Monthly Reports tab strip */}
          <div className="flex items-center gap-6 px-5 border-b border-clinical-200 sticky top-0 bg-white z-10">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                    isActive
                      ? 'border-primary-600 text-primary-600'
                      : 'border-transparent text-clinical-400 hover:text-clinical-700'
                  }`}
                >
                  <Icon size={15} />
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span
                      className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive ? 'bg-primary-50 text-primary-700' : 'bg-clinical-100 text-clinical-500'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="p-5 space-y-5">

            {/* ═══ CONSULTATION TAB ═══════════════════════════════════════════ */}
            {activeTab === 'consultation' && (
              <>
                {/* Chief complaint */}
                <div>
                  <label className="block text-xs font-bold text-clinical-800 mb-1.5">Chief Complaint</label>
                  <textarea
                    rows={2}
                    value={form.chiefComplaint}
                    onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })}
                    placeholder="Patient's primary reason for visit..."
                    className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* History */}
                <div>
                  <label className="block text-xs font-bold text-clinical-800 mb-1.5">History of Present Illness</label>
                  <textarea
                    rows={3}
                    value={form.historyOfPresentIllness}
                    onChange={(e) => setForm({ ...form, historyOfPresentIllness: e.target.value })}
                    placeholder="Onset, duration, severity, associated symptoms..."
                    className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* Examination */}
                <div>
                  <label className="block text-xs font-bold text-clinical-800 mb-1.5">Examination Findings</label>
                  <textarea
                    rows={3}
                    value={form.examinationFindings}
                    onChange={(e) => setForm({ ...form, examinationFindings: e.target.value })}
                    placeholder="Clinical examination notes..."
                    className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm resize-y focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* ── Diagnosis codes (ICD-10) ─────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-xs font-bold text-clinical-800">Diagnosis Codes (ICD-10)</label>
                      <p className="text-[10px] text-clinical-400 mt-0.5">
                        First code is the primary diagnosis. Type a code or keyword to search.
                      </p>
                    </div>
                    <button
                      onClick={addDxCode}
                      className="flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700 border border-primary-200 hover:border-primary-400 rounded-lg px-2.5 py-1.5 bg-primary-50 hover:bg-primary-100 transition-colors"
                    >
                      <Plus size={12} /> Add code
                    </button>
                  </div>

                  {/* Column headers */}
                  {diagnosisCodes.length > 0 && (
                    <div className="flex gap-2 mb-1 px-1">
                      <span className="text-[10px] text-clinical-400" style={{ width: '120px', flexShrink: 0 }}>ICD-10 code</span>
                      <span className="text-[10px] text-clinical-400 flex-1">Description</span>
                      <span className="text-[10px] text-clinical-400" style={{ width: '110px', flexShrink: 0 }}>Type</span>
                      <span style={{ width: '28px', flexShrink: 0 }} />
                    </div>
                  )}

                  {/* Rows */}
                  <div className="space-y-2">
                    {diagnosisCodes.map((row, idx) => (
                      <DxRow
                        key={idx}
                        row={row}
                        index={idx}
                        onChange={(updated) => updateDxCode(idx, updated)}
                        onRemove={() => removeDxCode(idx)}
                      />
                    ))}
                  </div>

                  {/* Empty state */}
                  {diagnosisCodes.length === 0 && (
                    <div className="border border-dashed border-clinical-200 rounded-lg py-4 text-center text-xs text-clinical-400">
                      No diagnosis codes added yet.{' '}
                      <button
                        onClick={addDxCode}
                        className="text-primary-600 font-semibold hover:underline"
                      >
                        Add the first code
                      </button>
                    </div>
                  )}

                  {/* Summary chips */}
                  {filledCodes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5 bg-clinical-50 rounded-lg p-2">
                      {filledCodes.map((d, i) => {
                        const chipClass =
                          d.type === 'primary'      ? 'bg-primary-100 text-primary-800 border-primary-200' :
                          d.type === 'secondary'    ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          d.type === 'complication' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                                                      'bg-gray-100 text-gray-700 border-gray-200';
                        return (
                          <span
                            key={i}
                            className={`inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-[10px] font-semibold ${chipClass}`}
                          >
                            <span className="font-mono">{d.code || '—'}</span>
                            {d.description && (
                              <span className="font-normal opacity-80">
                                · {d.description.length > 30 ? d.description.slice(0, 30) + '…' : d.description}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Free-text diagnosis (kept for backwards compatibility / notes) */}
                <div>
                  <label className="block text-xs font-bold text-clinical-800 mb-1.5">
                    Doctor's notes / additional diagnosis
                  </label>
                  <input
                    value={form.diagnosis}
                    onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
                    placeholder="Additional notes or diagnosis summary…"
                    className="w-full border border-clinical-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-primary-500"
                  />
                </div>

                {/* ── Save / Complete ───────────────────────────────────────────── */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-clinical-200 text-clinical-600 hover:border-clinical-300 disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving…' : 'Save Draft'}
                  </button>
                  <button
                    onClick={() => completeMutation.mutate()}
                    disabled={completeMutation.isPending}
                    className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {completeMutation.isPending ? 'Completing…' : 'Complete Consultation'}
                  </button>
                </div>
              </>
            )}

            {/* ═══ LAB TAB ═════════════════════════════════════════════════════ */}
            {activeTab === 'lab' && (
              <div>
                <label className="block text-xs font-bold text-clinical-800 mb-2">Lab Tests</label>
                <div className="space-y-2 mb-2">
                  {labOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-clinical-800">{order.testName}</span>
                      <span
                        className={
                          'px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ' +
                          (order.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : order.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'sample_collected'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-clinical-100 text-clinical-600')
                        }
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                  {labOrders.length === 0 && (
                    <p className="text-xs text-clinical-400">No lab tests ordered for this visit yet.</p>
                  )}
                </div>
                {selectedTestIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedTestIds.map((id) => {
                      const t = labTests.find((lt) => lt.id === id);
                      if (!t) return null;
                      return (
                        <span
                          key={id}
                          className="flex items-center gap-1 bg-primary-50 text-primary-700 text-[11px] font-semibold px-2 py-1 rounded-full"
                        >
                          {t.name}{t.isPanel ? ' (panel)' : ''}
                          <button
                            onClick={() =>
                              setSelectedTestIds((ids) => ids.filter((x) => x !== id))
                            }
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id && !selectedTestIds.includes(id)) {
                        setSelectedTestIds((ids) => [...ids, id]);
                      }
                    }}
                    className="flex-1 border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select a test to order…</option>
                    {Object.entries(
                      labTests.reduce<Record<string, LabTest[]>>((acc, t) => {
                        const cat = t.category || 'Other';
                        (acc[cat] ||= []).push(t);
                        return acc;
                      }, {}),
                    ).map(([category, tests]) => (
                      <optgroup key={category} label={category}>
                        {tests.map((t) => (
                          <option key={t.id} value={t.id} disabled={selectedTestIds.includes(t.id)}>
                            {t.name}{t.isPanel ? ' (panel)' : ''}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedTestIds.length > 0 && orderLabMutation.mutate()}
                    disabled={selectedTestIds.length === 0 || orderLabMutation.isPending}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                  >
                    Order Test{selectedTestIds.length > 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ PRESCRIPTIONS TAB ══════════════════════════════════════════ */}
            {activeTab === 'prescriptions' && (
              <div>
                <label className="block text-xs font-bold text-clinical-800 mb-2">Prescription</label>
                <div className="space-y-2 mb-2">
                  {visit.prescriptions.map((rx) => (
                    <div
                      key={rx.id}
                      className="flex items-center gap-2 text-xs bg-clinical-50/60 border border-clinical-100 rounded-lg px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-clinical-800">{rx.drugName}</span>
                          <span
                            className={
                              'px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ' +
                              (rx.status === 'dispensed'
                                ? 'bg-green-100 text-green-700'
                                : rx.status === 'cancelled'
                                ? 'bg-gray-100 text-gray-500'
                                : 'bg-yellow-100 text-yellow-700')
                            }
                          >
                            {rx.status ?? 'pending'}
                          </span>
                        </div>
                        <p className="text-clinical-500 mt-0.5">
                          {[rx.dose, rx.frequency, rx.duration].filter(Boolean).join(' · ') ||
                            'No dosage details'}
                        </p>
                      </div>
                      <button
                        onClick={() => removeRxMutation.mutate(rx.id)}
                        className="w-8 h-8 rounded-lg border border-clinical-200 text-clinical-400 hover:border-red-400 hover:text-red-500 flex items-center justify-center flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {visit.prescriptions.length === 0 && (
                    <p className="text-xs text-clinical-400">No prescriptions sent for this visit yet.</p>
                  )}
                </div>

                <div className="flex flex-wrap md:flex-nowrap gap-2 items-start">
                  {/* Drug name — dropdown from pharmacy medicines + free-text fallback */}
                  <div className="relative" style={{ flex: '1 1 0%', minWidth: '160px' }}>
                    <input
                      type="text"
                      value={rxDraft.drugName}
                      onChange={(e) => {
                        setRxDraft({ ...rxDraft, drugName: e.target.value });
                        setRxMedicineSearch(e.target.value);
                        setRxShowDropdown(true);
                      }}
                      onFocus={() => {
                        setRxMedicineSearch(rxDraft.drugName);
                        setRxShowDropdown(true);
                      }}
                      onBlur={() => setTimeout(() => setRxShowDropdown(false), 150)}
                      placeholder="Drug name or search…"
                      style={{ width: '100%' }}
                      className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                    />
                    {rxShowDropdown && (
                      <div
                        className="absolute z-30 top-full left-0 bg-white border border-clinical-200 rounded-lg shadow-lg overflow-y-auto"
                        style={{ width: '260px', maxHeight: '192px', marginTop: '4px' }}
                      >
                        {medicines
                          .filter(
                            (m) =>
                              !rxMedicineSearch ||
                              m.name.toLowerCase().includes(rxMedicineSearch.toLowerCase()) ||
                              (m.genericName ?? '').toLowerCase().includes(rxMedicineSearch.toLowerCase()),
                          )
                          .slice(0, 20)
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onMouseDown={() => {
                                setRxDraft({ ...rxDraft, drugName: m.name });
                                setRxMedicineSearch(m.name);
                                setRxShowDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-clinical-50 flex items-center justify-between gap-2 whitespace-nowrap overflow-hidden"
                            >
                              <span className="font-medium text-clinical-900 truncate">{m.name}</span>
                              {m.genericName && (
                                <span className="text-clinical-400 truncate text-[11px]">{m.genericName}</span>
                              )}
                            </button>
                          ))}
                        {rxMedicineSearch &&
                          !medicines.some(
                            (m) => m.name.toLowerCase() === rxMedicineSearch.toLowerCase(),
                          ) && (
                            <button
                              type="button"
                              onMouseDown={() => {
                                setRxDraft({ ...rxDraft, drugName: rxMedicineSearch });
                                setRxShowDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-xs hover:bg-clinical-50 text-clinical-500 border-t border-clinical-100 truncate"
                            >
                              + Use "{rxMedicineSearch}" as free text
                            </button>
                          )}
                        {medicines.length === 0 && (
                          <p className="px-3 py-2 text-xs text-clinical-400">
                            No medicines in stock — type any name
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  <input
                    value={rxDraft.dose}
                    onChange={(e) => setRxDraft({ ...rxDraft, dose: e.target.value })}
                    placeholder="Dose"
                    style={{ flex: '0 1 90px', minWidth: '80px' }}
                    className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                  />
                  <input
                    value={rxDraft.frequency}
                    onChange={(e) => setRxDraft({ ...rxDraft, frequency: e.target.value })}
                    placeholder="Frequency"
                    style={{ flex: '0 1 90px', minWidth: '80px' }}
                    className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                  />
                  <input
                    value={rxDraft.duration}
                    onChange={(e) => setRxDraft({ ...rxDraft, duration: e.target.value })}
                    placeholder="Duration"
                    style={{ flex: '0 1 90px', minWidth: '80px' }}
                    className="border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                  />
                  <div style={{ width: '32px', flexShrink: 0 }} />
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => rxDraft.drugName && addRxMutation.mutate()}
                    disabled={!rxDraft.drugName || addRxMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                  >
                    <Plus size={13} /> {addRxMutation.isPending ? 'Sending…' : 'Send to Pharmacy'}
                  </button>
                </div>
              </div>
            )}

            {/* ═══ RADIOLOGY TAB ═══════════════════════════════════════════════ */}
            {activeTab === 'radiology' && (
              <div>
                <label className="block text-xs font-bold text-clinical-800 mb-2">Radiology</label>
                <div className="space-y-2 mb-2">
                  {radiologyOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between text-xs">
                      <span className="font-medium text-clinical-800">{order.testName}</span>
                      <span
                        className={
                          'px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ' +
                          (order.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : order.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-clinical-100 text-clinical-600')
                        }
                      >
                        {order.status.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                  {radiologyOrders.length === 0 && (
                    <p className="text-xs text-clinical-400">No radiology studies ordered for this visit yet.</p>
                  )}
                </div>
                {selectedRadiologyTestIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedRadiologyTestIds.map((id) => {
                      const t = radiologyTests.find((rt) => rt.id === id);
                      if (!t) return null;
                      return (
                        <span
                          key={id}
                          className="flex items-center gap-1 bg-primary-50 text-primary-700 text-[11px] font-semibold px-2 py-1 rounded-full"
                        >
                          {t.name}
                          <button
                            onClick={() =>
                              setSelectedRadiologyTestIds((ids) => ids.filter((x) => x !== id))
                            }
                          >
                            ×
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <div className="flex gap-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const id = e.target.value;
                      if (id && !selectedRadiologyTestIds.includes(id)) {
                        setSelectedRadiologyTestIds((ids) => [...ids, id]);
                      }
                    }}
                    className="flex-1 border border-clinical-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:border-primary-500"
                  >
                    <option value="">Select a study to order…</option>
                    {Object.entries(
                      radiologyTests.reduce<Record<string, RadiologyTest[]>>((acc, t) => {
                        const cat = t.category || 'Other';
                        (acc[cat] ||= []).push(t);
                        return acc;
                      }, {}),
                    ).map(([category, tests]) => (
                      <optgroup key={category} label={category}>
                        {tests.map((t) => (
                          <option key={t.id} value={t.id} disabled={selectedRadiologyTestIds.includes(t.id)}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={() => selectedRadiologyTestIds.length > 0 && orderRadiologyMutation.mutate()}
                    disabled={selectedRadiologyTestIds.length === 0 || orderRadiologyMutation.isPending}
                    className="px-3 py-2 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40"
                  >
                    Order Stud{selectedRadiologyTestIds.length > 1 ? 'ies' : 'y'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── Right: visit timeline (pinned across all tabs) ───────────────────── */}
        <div className="p-5 overflow-y-auto max-h-[820px]">
          <h4 className="text-[11px] font-bold text-clinical-400 uppercase tracking-wide mb-3">
            Visit Timeline
          </h4>
          <div className="space-y-4">
            {timeline.map((t, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="w-2 h-2 rounded-full bg-primary-600 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-clinical-800">{t.title}</p>
                  <p className="text-[11px] text-clinical-400 mt-0.5">
                    {new Date(t.date!).toLocaleString('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>
            ))}
            {timeline.length === 0 && (
              <p className="text-xs text-clinical-400">No timeline events yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
