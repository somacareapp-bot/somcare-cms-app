import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Trash2, Download, Loader2, ChevronDown, Search } from 'lucide-react';
import { billingApi, patientsApi } from '../../services/api';

type ChargeCategory = 'appointment' | 'lab' | 'radiology' | 'pharmacy';

// Must match the backend's RevenueCategory enum (and the Postgres enum
// invoice_items_revenue_category_enum) exactly — any value not in this
// list will be rejected by the API.
type RevenueCategory =
  | 'consultation' | 'laboratory' | 'pharmacy' | 'radiology' | 'registration'
  | 'emergency' | 'procedure' | 'surgery' | 'admission' | 'bed_charges'
  | 'ward_charges' | 'private_room' | 'icu' | 'nicu' | 'maternity'
  | 'delivery' | 'caesarean' | 'antenatal' | 'postnatal' | 'family_planning'
  | 'pediatric' | 'dental' | 'physiotherapy' | 'rehabilitation' | 'ambulance'
  | 'home_care' | 'nursing' | 'dressing' | 'injection' | 'iv_therapy'
  | 'blood_bank' | 'blood_transfusion' | 'operating_theatre' | 'anesthesia'
  | 'endoscopy' | 'minor_surgery' | 'major_surgery' | 'orthopedic' | 'cardiology'
  | 'dermatology' | 'ophthalmology' | 'ent' | 'gynecology' | 'neurology'
  | 'mental_health' | 'nutrition' | 'counseling' | 'health_screening'
  | 'medical_checkup' | 'occupational_health' | 'pre_employment' | 'certificates'
  | 'medical_reports' | 'patient_card' | 'medical_records' | 'vaccination'
  | 'immunization' | 'insurance_claims' | 'corporate_health' | 'school_health'
  | 'travel_medical' | 'visa_medical' | 'home_nursing' | 'specialist'
  | 'followup' | 'health_education' | 'equipment_rental' | 'room_service'
  | 'other_clinical' | 'other';

const REVENUE_CATEGORY_OPTIONS: { value: RevenueCategory; label: string }[] = [
  { value: 'consultation',     label: 'Consultation Fees' },
  { value: 'laboratory',       label: 'Laboratory Fees' },
  { value: 'pharmacy',         label: 'Pharmacy Sales' },
  { value: 'radiology',        label: 'Radiology Services' },
  { value: 'registration',     label: 'Registration Fees' },
  { value: 'emergency',        label: 'Emergency Services' },
  { value: 'procedure',        label: 'Procedure Fees' },
  { value: 'surgery',          label: 'Surgery Fees' },
  { value: 'admission',        label: 'Admission Fees' },
  { value: 'bed_charges',      label: 'Bed Charges' },
  { value: 'ward_charges',     label: 'Ward Charges' },
  { value: 'private_room',     label: 'Private Room Charges' },
  { value: 'icu',              label: 'ICU Charges' },
  { value: 'nicu',             label: 'NICU Charges' },
  { value: 'maternity',        label: 'Maternity Services' },
  { value: 'delivery',         label: 'Delivery Services' },
  { value: 'caesarean',        label: 'Caesarean Section' },
  { value: 'antenatal',        label: 'Antenatal Care' },
  { value: 'postnatal',        label: 'Postnatal Care' },
  { value: 'family_planning',  label: 'Family Planning Services' },
  { value: 'pediatric',        label: 'Pediatric Services' },
  { value: 'dental',           label: 'Dental Services' },
  { value: 'physiotherapy',    label: 'Physiotherapy Services' },
  { value: 'rehabilitation',   label: 'Rehabilitation Services' },
  { value: 'ambulance',        label: 'Ambulance Services' },
  { value: 'home_care',        label: 'Home Care Services' },
  { value: 'nursing',          label: 'Nursing Services' },
  { value: 'dressing',         label: 'Dressing Services' },
  { value: 'injection',        label: 'Injection Services' },
  { value: 'iv_therapy',       label: 'IV Therapy' },
  { value: 'blood_bank',       label: 'Blood Bank Services' },
  { value: 'blood_transfusion',label: 'Blood Transfusion' },
  { value: 'operating_theatre',label: 'Operating Theatre Fees' },
  { value: 'anesthesia',       label: 'Anesthesia Fees' },
  { value: 'endoscopy',        label: 'Endoscopy Services' },
  { value: 'minor_surgery',    label: 'Minor Surgery' },
  { value: 'major_surgery',    label: 'Major Surgery' },
  { value: 'orthopedic',       label: 'Orthopedic Services' },
  { value: 'cardiology',       label: 'Cardiology Services' },
  { value: 'dermatology',      label: 'Dermatology Services' },
  { value: 'ophthalmology',    label: 'Ophthalmology Services' },
  { value: 'ent',              label: 'ENT Services' },
  { value: 'gynecology',       label: 'Gynecology Services' },
  { value: 'neurology',        label: 'Neurology Services' },
  { value: 'mental_health',    label: 'Mental Health Services' },
  { value: 'nutrition',        label: 'Nutrition Services' },
  { value: 'counseling',       label: 'Counseling Services' },
  { value: 'health_screening', label: 'Health Screening' },
  { value: 'medical_checkup',  label: 'Medical Check-up' },
  { value: 'occupational_health', label: 'Occupational Health' },
  { value: 'pre_employment',   label: 'Pre-Employment Medical' },
  { value: 'certificates',     label: 'Medical Certificates' },
  { value: 'medical_reports',  label: 'Medical Reports' },
  { value: 'patient_card',     label: 'Patient Card Fees' },
  { value: 'medical_records',  label: 'Medical Record Fees' },
  { value: 'vaccination',      label: 'Vaccination Services' },
  { value: 'immunization',     label: 'Immunization Services' },
  { value: 'insurance_claims', label: 'Insurance Claims' },
  { value: 'corporate_health', label: 'Corporate Health Services' },
  { value: 'school_health',    label: 'School Health Services' },
  { value: 'travel_medical',   label: 'Travel Medical Services' },
  { value: 'visa_medical',     label: 'Visa Medical Services' },
  { value: 'home_nursing',     label: 'Home Nursing' },
  { value: 'specialist',       label: 'Specialist Services' },
  { value: 'followup',         label: 'Follow-up Consultation' },
  { value: 'health_education', label: 'Health Education Services' },
  { value: 'equipment_rental', label: 'Medical Equipment Rental' },
  { value: 'room_service',     label: 'Room Service Charges' },
  { value: 'other_clinical',   label: 'Other Clinical Services' },
  { value: 'other',            label: 'Other Revenue' },
];

const CHARGE_TO_REVENUE_CATEGORY: Record<ChargeCategory, RevenueCategory> = {
  appointment: 'consultation',
  lab: 'laboratory',
  radiology: 'radiology',
  pharmacy: 'pharmacy',
};

// Maps a charge category to the source type BillingService stamps
// invoicedAt on — must match backend CreateInvoiceDto's sourceType union.
const CATEGORY_TO_SOURCE_TYPE: Record<ChargeCategory, 'appointment' | 'lab_charge' | 'radiology_item' | undefined> = {
  appointment: 'appointment',
  lab: 'lab_charge',
  radiology: 'radiology_item',
  pharmacy: undefined,
};

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  auto?: boolean;
  category?: ChargeCategory;
  revenueCategory: RevenueCategory;
  sourceType?: 'appointment' | 'lab_charge' | 'radiology_item';
  sourceId?: string;
}

function emptyItem(): LineItem {
  return { id: crypto.randomUUID(), description: '', qty: 1, unitPrice: 0, revenueCategory: 'other' };
}

function usePatients() {
  return useQuery({
    queryKey: ['patients', 'all'],
    queryFn: async () => {
      const res = await patientsApi.getAll();
      return res.data?.data ?? res.data ?? [];
    },
    placeholderData: [],
  });
}

// ─── Searchable Category Dropdown ────────────────────────────────────────────
interface SearchableSelectProps {
  value: RevenueCategory;
  onChange: (val: RevenueCategory) => void;
}

function SearchableCategorySelect({ value, onChange }: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = REVENUE_CATEGORY_OPTIONS.find((o) => o.value === value);

  const filtered = query.trim()
    ? REVENUE_CATEGORY_OPTIONS.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      )
    : REVENUE_CATEGORY_OPTIONS;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  const handleSelect = (val: RevenueCategory) => {
    onChange(val);
    setOpen(false);
    setQuery('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'Enter' && filtered.length > 0) handleSelect(filtered[0].value);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = wrapRef.current?.querySelector<HTMLElement>('[data-option]');
      first?.focus();
    }
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, val: RevenueCategory, idx: number) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(val); }
    if (e.key === 'Escape') { setOpen(false); setQuery(''); }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const opts = wrapRef.current?.querySelectorAll<HTMLElement>('[data-option]');
      opts?.[idx + 1]?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx === 0) { searchRef.current?.focus(); return; }
      const opts = wrapRef.current?.querySelectorAll<HTMLElement>('[data-option]');
      opts?.[idx - 1]?.focus();
    }
  };

  const highlight = (text: string) => {
    if (!query.trim()) return text;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-100 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
        {text.slice(idx + query.length)}
      </>
    );
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between rounded-lg border px-3 py-2 text-sm text-left focus:outline-none transition-colors ${
          open
            ? 'border-blue-500 ring-2 ring-blue-100'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
          {selected?.label ?? 'Select category'}
        </span>
        <ChevronDown
          size={14}
          className={`ml-2 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 min-w-[240px] rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 relative">
            <Search size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search category…"
              className="w-full rounded-md border border-gray-200 bg-gray-50 pl-7 pr-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 focus:bg-white"
            />
          </div>

          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-xs text-gray-400 text-center">No results found</div>
            )}
            {filtered.map((opt, idx) => (
              <div
                key={opt.value}
                data-option
                tabIndex={0}
                onClick={() => handleSelect(opt.value)}
                onKeyDown={(e) => handleOptionKeyDown(e, opt.value, idx)}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer outline-none transition-colors ${
                  opt.value === value
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 focus:bg-gray-50'
                }`}
              >
                <span className="w-5 text-right text-xs text-gray-300 flex-shrink-0">
                  {REVENUE_CATEGORY_OPTIONS.indexOf(opt) + 1}
                </span>
                <span>{highlight(opt.label)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function CreateInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: patients = [] } = usePatients();
  const [searchParams] = useSearchParams();

  const [patientId, setPatientId] = useState(() => searchParams.get('patientId') ?? '');
  const [visitId] = useState(() => searchParams.get('visitId') ?? '');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [dueDate, setDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<LineItem[]>([emptyItem()]);
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);
  const [emptyLoadNotice, setEmptyLoadNotice] = useState<string | null>(null);

  const loadChargesMutation = useMutation({
    mutationFn: (target: ChargeCategory | 'all') =>
      billingApi.getVisitSummary(visitId).then((res) => ({ target, data: res.data })),
    onSuccess: ({ target, data }) => {
      const { appointment, labItems, radiologyItems } = data;
      const wanted: ChargeCategory[] =
        target === 'all' ? ['appointment', 'lab', 'radiology'] : [target];

      let additionsCount = 0;

      setItems((prev) => {
        const kept = prev.filter(
          (i) => (!i.auto && i.description.trim() !== '') || (i.auto && i.category && !wanted.includes(i.category))
        );
        const additions: LineItem[] = [];

        if (wanted.includes('appointment') && appointment && appointment.fee > 0) {
          additions.push({
            id: crypto.randomUUID(),
            description: 'Appointment / Consultation Fee',
            qty: 1,
            unitPrice: appointment.fee,
            auto: true,
            category: 'appointment',
            revenueCategory: CHARGE_TO_REVENUE_CATEGORY.appointment,
            sourceType: CATEGORY_TO_SOURCE_TYPE.appointment,
            sourceId: appointment.id,
          });
        }
        if (wanted.includes('lab')) {
          (labItems ?? []).forEach((t: { id: string; name: string; price: number }) => {
            additions.push({
              id: crypto.randomUUID(),
              description: `Lab: ${t.name}`,
              qty: 1,
              unitPrice: t.price,
              auto: true,
              category: 'lab',
              revenueCategory: CHARGE_TO_REVENUE_CATEGORY.lab,
              sourceType: CATEGORY_TO_SOURCE_TYPE.lab,
              sourceId: t.id,
            });
          });
        }
        if (wanted.includes('radiology')) {
          (radiologyItems ?? []).forEach((t: { id: string; name: string; price: number }) => {
            additions.push({
              id: crypto.randomUUID(),
              description: `Radiology: ${t.name}`,
              qty: 1,
              unitPrice: t.price,
              auto: true,
              category: 'radiology',
              revenueCategory: CHARGE_TO_REVENUE_CATEGORY.radiology,
              sourceType: CATEGORY_TO_SOURCE_TYPE.radiology,
              sourceId: t.id,
            });
          });
        }

        additionsCount = additions.length;
        return [...kept, ...additions, emptyItem()];
      });

      // Everything for the requested category(ies) was either already on
      // this invoice or already billed on a previous one — nothing new to add.
      setEmptyLoadNotice(
        additionsCount === 0
          ? 'Nothing to load — these charges are already on this invoice or were already billed on a previous one.'
          : null,
      );
    },
  });

  const loadCategory = (target: ChargeCategory | 'all') => {
    setLoadMenuOpen(false);
    loadChargesMutation.mutate(target);
  };

  const subtotal = items.reduce((sum, i) => sum + i.qty * i.unitPrice, 0);
  const total = subtotal + Number(tax) - Number(discount);

  const updateItem = (id: string, patch: Partial<LineItem>) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: (data: any) => billingApi.create(data),
    onSuccess: () => {
      setSubmitError(null);
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      navigate('/billing/invoices');
    },
    onError: (err: any) => {
      const backendMessage = err?.response?.data?.message;
      setSubmitError(
        Array.isArray(backendMessage)
          ? backendMessage.join(', ')
          : backendMessage || 'Failed to create invoice. Please check the form and try again.'
      );
    },
  });

  const handleSubmit = () => {
    setSubmitError(null);
    const patient = patients.find((p: any) => p.id === patientId);
    if (!patient) return;
    createMutation.mutate({
      patientId,
      patientName: `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || patient.name,
      paymentMethod,
      dueDate,
      notes,
      tax: Number(tax),
      discount: Number(discount),
      items: items
        .filter((i) => i.description.trim())
        .map((i) => ({
          description: i.description,
          qty: i.qty,
          unitPrice: i.unitPrice,
          revenueCategory: i.revenueCategory,
          sourceType: i.sourceType,
          sourceId: i.sourceId,
        })),
    });
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-gray-900">Create Invoice</h1>
        <p className="text-sm text-gray-500">Generate a new billing invoice</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Invoice Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-gray-700">Invoice Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Patient *</label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select patient</option>
                {patients.map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {`${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="insurance">Insurance</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Notes</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Line Items</h2>
            <div className="flex items-center gap-2">
              {visitId && (
                <div className="relative">
                  <button
                    onClick={() => setLoadMenuOpen((o) => !o)}
                    disabled={loadChargesMutation.isPending}
                    className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {loadChargesMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    Load Charges
                    <ChevronDown size={14} />
                  </button>
                  {loadMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setLoadMenuOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button onClick={() => loadCategory('appointment')} className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">Load Appointment Fee</button>
                        <button onClick={() => loadCategory('lab')} className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">Load Lab Charges</button>
                        <button onClick={() => loadCategory('radiology')} className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50">Load Radiology Charges</button>
                        <div className="my-1 border-t border-gray-100" />
                        <button onClick={() => loadCategory('all')} className="block w-full px-3 py-2 text-left text-xs font-medium text-blue-700 hover:bg-blue-50">Load All</button>
                      </div>
                    </>
                  )}
                </div>
              )}
              <button
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus size={14} />
                Add Item
              </button>
            </div>
          </div>

          {loadChargesMutation.isError && (
            <p className="mb-3 text-xs text-red-600">Couldn't load charges for this visit.</p>
          )}
          {emptyLoadNotice && (
            <p className="mb-3 text-xs text-amber-600">{emptyLoadNotice}</p>
          )}

          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 items-end gap-3">
                <div className="col-span-4">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    placeholder="Service description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="col-span-3">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Revenue Source</label>
                  <SearchableCategorySelect
                    value={item.revenueCategory}
                    onChange={(val) => updateItem(item.id, { revenueCategory: val })}
                  />
                </div>

                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Qty</label>
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateItem(item.id, { qty: Math.max(1, Number(e.target.value)) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Unit Price</label>
                  <input
                    type="number"
                    min={0}
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value)) })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-1 pb-2 text-sm font-medium text-gray-800">
                  ${(item.qty * item.unitPrice).toFixed(2)}
                </div>
                <div className="col-span-1 pb-2 flex justify-end">
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Tax ($)</label>
              <input
                type="number"
                min={0}
                value={tax}
                onChange={(e) => setTax(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Discount ($)</label>
              <input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-end gap-1 border-t pt-3">
            <div className="text-sm text-gray-500">Subtotal: ${subtotal.toFixed(2)}</div>
            <div className="text-lg font-semibold text-gray-900">Total: ${total.toFixed(2)}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={!patientId || createMutation.isPending}
            className="rounded-lg bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Creating...' : 'Create Invoice'}
          </button>
          {submitError && (
            <p className="mt-2 text-sm text-red-600">{submitError}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default CreateInvoicePage;
