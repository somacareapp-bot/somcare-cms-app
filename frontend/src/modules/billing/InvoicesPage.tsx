import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Download, Plus, Eye, Trash2, X, Printer, CreditCard } from 'lucide-react';
import { billingApi } from '../../services/api';

interface InvoiceItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  revenueCategory?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientName: string;
  createdAt: string;
  total: number;
  paid: number;
  status: 'paid' | 'partial' | 'unpaid';
  paymentMethod: string;
  items: InvoiceItem[];
}

function useInvoices(search?: string) {
  return useQuery<Invoice[]>({
    queryKey: ['billing', 'invoices', search],
    queryFn: async () => {
      const res = await billingApi.getAll(undefined, search || undefined);
      return res.data ?? [];
    },
    placeholderData: [],
    retry: 1,
  });
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const map = {
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-yellow-100 text-yellow-700',
    unpaid: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

// ── Revenue Source label + colour map (all 70) ────────────────────────────
const REVENUE_LABELS: Record<string, string> = {
  consultation:      'Consultation Fees',
  laboratory:        'Laboratory Fees',
  pharmacy:          'Pharmacy Sales',
  radiology:         'Radiology Services',
  registration:      'Registration Fees',
  emergency:         'Emergency Services',
  procedure:         'Procedure Fees',
  surgery:           'Surgery Fees',
  admission:         'Admission Fees',
  bed_charges:       'Bed Charges',
  ward_charges:      'Ward Charges',
  private_room:      'Private Room Charges',
  icu:               'ICU Charges',
  nicu:              'NICU Charges',
  maternity:         'Maternity Services',
  delivery:          'Delivery Services',
  caesarean:         'Caesarean Section',
  antenatal:         'Antenatal Care',
  postnatal:         'Postnatal Care',
  family_planning:   'Family Planning',
  pediatric:         'Pediatric Services',
  dental:            'Dental Services',
  physiotherapy:     'Physiotherapy',
  rehabilitation:    'Rehabilitation',
  ambulance:         'Ambulance Services',
  home_care:         'Home Care',
  nursing:           'Nursing Services',
  dressing:          'Dressing Services',
  injection:         'Injection Services',
  iv_therapy:        'IV Therapy',
  blood_bank:        'Blood Bank',
  blood_transfusion: 'Blood Transfusion',
  operating_theatre: 'Operating Theatre',
  anesthesia:        'Anesthesia Fees',
  endoscopy:         'Endoscopy',
  minor_surgery:     'Minor Surgery',
  major_surgery:     'Major Surgery',
  orthopedic:        'Orthopedic',
  cardiology:        'Cardiology',
  dermatology:       'Dermatology',
  ophthalmology:     'Ophthalmology',
  ent:               'ENT Services',
  gynecology:        'Gynecology',
  neurology:         'Neurology',
  mental_health:     'Mental Health',
  nutrition:         'Nutrition',
  counseling:        'Counseling',
  health_screening:  'Health Screening',
  medical_checkup:   'Medical Check-up',
  occupational_health:'Occupational Health',
  pre_employment:    'Pre-Employment',
  certificates:      'Medical Certificates',
  medical_reports:   'Medical Reports',
  patient_card:      'Patient Card Fees',
  medical_records:   'Medical Records',
  vaccination:       'Vaccination',
  immunization:      'Immunization',
  insurance_claims:  'Insurance Claims',
  corporate_health:  'Corporate Health',
  school_health:     'School Health',
  travel_medical:    'Travel Medical',
  visa_medical:      'Visa Medical',
  home_nursing:      'Home Nursing',
  specialist:        'Specialist',
  followup:          'Follow-up',
  health_education:  'Health Education',
  equipment_rental:  'Equipment Rental',
  room_service:      'Room Service',
  other_clinical:    'Other Clinical',
  other:             'Other Revenue',
};

// Colour buckets — group related categories by hue
function badgeStyle(key: string): string {
  if (['consultation', 'followup', 'specialist'].includes(key))
    return 'bg-purple-100 text-purple-700';
  if (['laboratory'].includes(key))
    return 'bg-blue-100 text-blue-700';
  if (['pharmacy'].includes(key))
    return 'bg-green-100 text-green-700';
  if (['radiology', 'endoscopy'].includes(key))
    return 'bg-cyan-100 text-cyan-700';
  if (['emergency', 'ambulance'].includes(key))
    return 'bg-red-100 text-red-700';
  if (['surgery', 'minor_surgery', 'major_surgery', 'operating_theatre', 'anesthesia'].includes(key))
    return 'bg-orange-100 text-orange-700';
  if (['maternity', 'delivery', 'caesarean', 'antenatal', 'postnatal', 'family_planning', 'gynecology', 'nicu'].includes(key))
    return 'bg-pink-100 text-pink-700';
  if (['icu', 'blood_bank', 'blood_transfusion', 'iv_therapy'].includes(key))
    return 'bg-rose-100 text-rose-700';
  if (['admission', 'bed_charges', 'ward_charges', 'private_room', 'room_service'].includes(key))
    return 'bg-indigo-100 text-indigo-700';
  if (['vaccination', 'immunization', 'health_screening', 'medical_checkup'].includes(key))
    return 'bg-teal-100 text-teal-700';
  if (['insurance_claims', 'corporate_health', 'pre_employment', 'visa_medical', 'travel_medical'].includes(key))
    return 'bg-sky-100 text-sky-700';
  return 'bg-gray-100 text-gray-600';
}

// Legacy description-based fallback for old invoices saved before revenueCategory existed
function legacyCategory(description: string): string {
  const d = (description || '').toLowerCase();
  if (d.startsWith('lab:')) return 'laboratory';
  if (d.startsWith('medicine:')) return 'pharmacy';
  if (d.startsWith('appointment')) return 'consultation';
  return 'other';
}

export function InvoiceSourceBadges({ items }: { items?: InvoiceItem[] }) {
  const keys = Array.from(
    new Set(
      (items ?? []).map((i) =>
        i.revenueCategory && i.revenueCategory !== 'other'
          ? i.revenueCategory
          : legacyCategory(i.description)
      )
    )
  );
  if (keys.length === 0) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span key={k} className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle(k)}`}>
          {REVENUE_LABELS[k] ?? k}
        </span>
      ))}
    </div>
  );
}

export function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const due = Number(invoice.total) - Number(invoice.paid);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">Invoice {invoice.invoiceNumber}</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Printer size={14} />
              Print Invoice
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs uppercase text-gray-400">Patient</div>
              <div className="font-medium text-gray-800">{invoice.patientName}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Date</div>
              <div className="font-medium text-gray-800">
                {new Date(invoice.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Total</div>
              <div className="font-medium text-gray-800">{money(invoice.total)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Status</div>
              <StatusBadge status={invoice.status} />
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Paid</div>
              <div className="font-medium text-green-600">{money(invoice.paid)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Due</div>
              <div className="font-medium text-red-600">{money(due)}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Generated by</div>
              <div className="font-medium text-gray-800">Admin User</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-400">Payment method</div>
              <div className="font-medium capitalize text-gray-800">{invoice.paymentMethod}</div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold uppercase text-gray-500">Items</div>
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-400">
                <tr>
                  <th className="pb-1 font-medium">Description</th>
                  <th className="pb-1 font-medium">Revenue Source</th>
                  <th className="pb-1 font-medium">Qty</th>
                  <th className="pb-1 font-medium">Unit Price</th>
                  <th className="pb-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoice.items?.map((item) => {
                  const key = item.revenueCategory && item.revenueCategory !== 'other'
                    ? item.revenueCategory
                    : legacyCategory(item.description);
                  return (
                    <tr key={item.id}>
                      <td className="py-1.5 text-gray-800">{item.description}</td>
                      <td className="py-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle(key)}`}>
                          {REVENUE_LABELS[key] ?? key}
                        </span>
                      </td>
                      <td className="py-1.5 text-gray-600">{item.qty}</td>
                      <td className="py-1.5 text-gray-600">{money(item.unitPrice)}</td>
                      <td className="py-1.5 text-right font-medium text-gray-800">
                        {money(item.qty * item.unitPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentModal({
  invoice,
  onClose,
  onSubmit,
}: {
  invoice: Invoice;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}) {
  const due = Number(invoice.total) - Number(invoice.paid);
  const [amount, setAmount] = useState(due);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">
            Record Payment — {invoice.invoiceNumber}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div className="text-sm text-gray-500">
            Amount due: <span className="font-medium text-red-600">${due.toFixed(2)}</span>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Amount ($)</label>
            <input
              type="number"
              min={0.01}
              max={due}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(amount)}
            disabled={amount <= 0 || amount > due}
            className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            Record Payment
          </button>
        </div>
      </div>
    </div>
  );
}

export function InvoicesPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { data: invoices = [] } = useInvoices(search);
  const [viewing, setViewing] = useState<Invoice | null>(null);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const queryClient = useQueryClient();

  const payMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      billingApi.recordPayment(id, amount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['billing'] });
      setPaying(null);
    },
  });

  const filtered = invoices;

  const exportCsv = () => {
    const header = ['Invoice #', 'Patient', 'Date', 'Total', 'Paid', 'Due', 'Status'];
    const rows = filtered.map((inv) => [
      inv.invoiceNumber,
      inv.patientName,
      new Date(inv.createdAt).toLocaleDateString(),
      inv.total,
      inv.paid,
      Number(inv.total) - Number(inv.paid),
      inv.status,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500">{filtered.length} invoices</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportCsv}
            className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button
            onClick={() => navigate('/billing/invoices/create')}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={16} />
            Create Invoice
          </button>
        </div>
      </div>

      <div className="mb-4 relative w-full max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by invoice #, patient name, patient code, or phone..."
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No invoices yet</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Invoice #</th>
                <th className="px-4 py-2 font-medium">Patient</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Total</th>
                <th className="px-4 py-2 font-medium">Paid</th>
                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Revenue Source</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-4 py-2 text-gray-800">{inv.patientName}</td>
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-2 text-gray-800">{money(inv.total)}</td>
                  <td className="px-4 py-2 text-green-600">{money(inv.paid)}</td>
                  <td className="px-4 py-2 text-red-600">
                    {money(Number(inv.total) - Number(inv.paid))}
                  </td>
                  <td className="px-4 py-2">
                    <InvoiceSourceBadges items={inv.items} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setViewing(inv)}
                        className="text-gray-400 hover:text-gray-600"
                        title="View"
                      >
                        <Eye size={16} />
                      </button>
                      {inv.status !== 'paid' && (
                        <button
                          onClick={() => setPaying(inv)}
                          className="text-gray-400 hover:text-green-600"
                          title="Record Payment"
                        >
                          <CreditCard size={16} />
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

      {viewing && <InvoiceModal invoice={viewing} onClose={() => setViewing(null)} />}
      {paying && (
        <PaymentModal
          invoice={paying}
          onClose={() => setPaying(null)}
          onSubmit={(amount) => payMutation.mutate({ id: paying.id, amount })}
        />
      )}
    </div>
  );
}

export default InvoicesPage;
