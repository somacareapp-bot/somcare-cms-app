import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Upload, ExternalLink, Building2, GitBranch, LayoutGrid, Stethoscope, Wrench, Users as UsersIcon, FlaskConical, Scan, CalendarDays, ListOrdered, Receipt, Package, Printer, Database, ChevronDown, ChevronRight, ShieldCheck, Pill, BedDouble, Clock, Globe, Bell, Tag, CreditCard, Truck, FileText, Cpu, Settings2, Layers, TestTube2, Microscope, Radio, UserCheck, Lock, BarChart3, DollarSign } from "lucide-react";
import { useListStore, useValueStore } from '../../stores/store';
import { useDraft } from './useDraft';
import { ToastProvider } from './components/Toast';
import { EditableTable, type ColumnDef } from './components/EditableTable';
import {
  PanelShell,
  FieldGrid,
  Field,
  TextInput,
  SelectInput,
  TextArea,
  ToggleRow,
  ChecklistGrid,
  WeeklyHoursEditor,
  PermissionMatrix,
} from './components/primitives';
import * as D from '../../stores/settingsData';
import { StaffDirectoryPage } from '../staff/StaffDirectoryPage';
import { BackupRestorePage } from './BackupRestorePage';
import { ResetDataPage } from './ResetDataPage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rolesApi, permissionsApi, usersApi, facilityApi, departmentsApi, wardsApi, loginSessionApi } from '../../services/api';
import { servicesCatalogApi } from '../../services/api';

/* ------------------------------------------------------------------ */
/*  Facility & Organization                                            */
/* ------------------------------------------------------------------ */

function FacilityInformation() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'facility'],
    queryFn: () => facilityApi.get().then((res) => res.data),
  });

  if (settings && !initialized) {
    setForm({
      name: settings.name ?? '',
      tagline: settings.tagline ?? '',
      address: settings.address ?? '',
      phone: settings.phone ?? '',
      email: settings.email ?? '',
      eDahabNumber: settings.eDahabNumber ?? '',
      zaadNumber: settings.zaadNumber ?? '',
      accountNumber: settings.accountNumber ?? '',
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => facilityApi.update(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] }),
  });

  const logoMutation = useMutation({
    mutationFn: (file: File) => facilityApi.uploadLogo(file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'facility'] }),
  });

  if (isLoading) {
    return <div className="text-sm text-clinical-400 py-6">Loading facility settings…</div>;
  }

  const resetForm = () => settings && setForm({
    name: settings.name ?? '',
    tagline: settings.tagline ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    eDahabNumber: settings.eDahabNumber ?? '',
    zaadNumber: settings.zaadNumber ?? '',
    accountNumber: settings.accountNumber ?? '',
  });

  return (
    <PanelShell
      title="Facility Information"
      description="Name, logo, address, and contact details"
      onSave={() => saveMutation.mutate()}
      onReset={resetForm}
    >
      <div className="border border-clinical-100 rounded-xl p-4 flex items-center gap-4 mb-4">
        <div className="w-16 h-16 rounded-lg border border-clinical-100 flex items-center justify-center overflow-hidden bg-gray-50 shrink-0">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt="Facility logo" className="w-full h-full object-contain" />
          ) : (
            <span className="text-[10px] text-clinical-400 text-center px-1">No logo</span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) logoMutation.mutate(file);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={logoMutation.isPending}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg border border-clinical-200 hover:bg-gray-50 transition-colors"
          >
            {logoMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {logoMutation.isPending ? 'Uploading…' : 'Upload Logo'}
          </button>
          <p className="text-[11px] text-clinical-400 mt-1.5">PNG, JPG, SVG or WEBP — up to 5MB.</p>
        </div>
      </div>
      <FieldGrid>
        <Field label="Facility Name"><TextInput value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Tagline"><TextInput value={form.tagline ?? ''} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></Field>
        <Field label="Address" full><TextInput value={form.address ?? ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <Field label="Phone"><TextInput value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="Email"><TextInput type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="E-Dahab Number"><TextInput value={form.eDahabNumber ?? ''} onChange={(e) => setForm({ ...form, eDahabNumber: e.target.value })} /></Field>
        <Field label="Zaad Number"><TextInput value={form.zaadNumber ?? ''} onChange={(e) => setForm({ ...form, zaadNumber: e.target.value })} /></Field>
        <Field label="Account Number"><TextInput value={form.accountNumber ?? ''} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Field>
      </FieldGrid>
    </PanelShell>
  );
}

function Branches() {
  const columns: ColumnDef<D.Branch>[] = [
    { key: 'name', label: 'Branch' },
    { key: 'address', label: 'Address' },
    { key: 'phone', label: 'Phone' },
    { key: 'manager', label: 'Manager' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  ];
  return (
    <PanelShell title="Branches" description="Manage clinic branches or satellite locations" hideFooter>
      <EditableTable
        store={D.branchesStore}
        columns={columns}
        addLabel="+ Add Branch"
        entityName="Branch"
        defaults={{ name: '', address: '', phone: '', manager: '', status: 'Active' }}
      />
    </PanelShell>
  );
}

function Departments() {
  const navigate = useNavigate();
  const { data: departments = [], isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.getAll().then((r) => r.data ?? []),
  });

  return (
    <PanelShell title="Departments" description="Clinical and admin department structure" hideFooter>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Live data from Operations &rarr; Departments. Manage departments there.
        </p>
        <button
          onClick={() => navigate('/departments')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ExternalLink size={14} />
          Manage Departments
        </button>
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : departments.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No departments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-semibold">Department</th>
                <th className="px-4 py-2 font-semibold">Head of Department</th>
                <th className="px-4 py-2 font-semibold">Rooms</th>
                <th className="px-4 py-2 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((d: any) => (
                <tr key={d.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-2 text-gray-600">{d.headDoctor?.fullName ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{d.rooms ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{d.staffCount ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}


const REVENUE_CATEGORY_OPTIONS = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'registration', label: 'Registration' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'procedure', label: 'Procedure' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'admission', label: 'Admission' },
  { value: 'bed_charges', label: 'Bed Charges' },
  { value: 'ward_charges', label: 'Ward Charges' },
  { value: 'private_room', label: 'Private Room' },
  { value: 'icu', label: 'Icu' },
  { value: 'nicu', label: 'Nicu' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'caesarean', label: 'Caesarean' },
  { value: 'antenatal', label: 'Antenatal' },
  { value: 'postnatal', label: 'Postnatal' },
  { value: 'family_planning', label: 'Family Planning' },
  { value: 'pediatric', label: 'Pediatric' },
  { value: 'dental', label: 'Dental' },
  { value: 'physiotherapy', label: 'Physiotherapy' },
  { value: 'rehabilitation', label: 'Rehabilitation' },
  { value: 'ambulance', label: 'Ambulance' },
  { value: 'home_care', label: 'Home Care' },
  { value: 'nursing', label: 'Nursing' },
  { value: 'dressing', label: 'Dressing' },
  { value: 'injection', label: 'Injection' },
  { value: 'iv_therapy', label: 'Iv Therapy' },
  { value: 'blood_bank', label: 'Blood Bank' },
  { value: 'blood_transfusion', label: 'Blood Transfusion' },
  { value: 'operating_theatre', label: 'Operating Theatre' },
  { value: 'anesthesia', label: 'Anesthesia' },
  { value: 'endoscopy', label: 'Endoscopy' },
  { value: 'minor_surgery', label: 'Minor Surgery' },
  { value: 'major_surgery', label: 'Major Surgery' },
  { value: 'orthopedic', label: 'Orthopedic' },
  { value: 'cardiology', label: 'Cardiology' },
  { value: 'dermatology', label: 'Dermatology' },
  { value: 'ophthalmology', label: 'Ophthalmology' },
  { value: 'ent', label: 'Ent' },
  { value: 'gynecology', label: 'Gynecology' },
  { value: 'neurology', label: 'Neurology' },
  { value: 'mental_health', label: 'Mental Health' },
  { value: 'nutrition', label: 'Nutrition' },
  { value: 'counseling', label: 'Counseling' },
  { value: 'health_screening', label: 'Health Screening' },
  { value: 'medical_checkup', label: 'Medical Checkup' },
  { value: 'other', label: 'Other' },
];

type ServiceRow = { id: string; name: string; price: number; revenueCategory: string; isActive: boolean; };
type ServiceForm = Omit<ServiceRow, 'id'>;
const EMPTY_FORM: ServiceForm = { name: '', price: 0, revenueCategory: 'other', isActive: true };

function Services() {
  const [rows, setRows] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async (q = '') => {
    try { setLoading(true); const res = await servicesCatalogApi.getAll(q);
      setRows(Array.isArray(res) ? res : (res?.data ?? res?.items ?? [])); }
    catch { setError('Failed to load services.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const startAdd  = () => { setEditingId('__new__'); setForm(EMPTY_FORM); setError(''); };
  const startEdit = (r: ServiceRow) => { setEditingId(r.id); setForm({ name: r.name, price: r.price, revenueCategory: r.revenueCategory, isActive: r.isActive }); setError(''); };
  const cancelEdit = () => { setEditingId(null); setError(''); };

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required.'); return; }
    try {
      setSaving(true);
      if (editingId === '__new__') await servicesCatalogApi.create(form);
      else                         await servicesCatalogApi.update(editingId!, form);
      setEditingId(null);
      await load(search);
    } catch (e: any) { setError(e?.response?.data?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this service?')) return;
    try { await servicesCatalogApi.remove(id); await load(search); }
    catch { setError('Delete failed.'); }
  };

  const toggle = async (r: ServiceRow) => {
    try { await servicesCatalogApi.update(r.id, { isActive: !r.isActive }); await load(search); }
    catch { setError('Update failed.'); }
  };

  const filtered = rows.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.revenueCategory.includes(search.toLowerCase())
  );

  const labelFor = (v: string) => REVENUE_CATEGORY_OPTIONS.find(o => o.value === v)?.label ?? v;

  return (
    <PanelShell title="Services Catalog" description="Billable services wired to invoicing — add, edit, or deactivate entries as needed." hideFooter>
      {/* toolbar */}
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          className="flex-1 min-w-[160px] border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search by name or category…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          onClick={startAdd} disabled={editingId !== null}
          className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
        >+ Add Service</button>
      </div>

      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      {/* inline add row */}
      {editingId === '__new__' && (
        <div className="border border-blue-300 rounded-md p-3 mb-3 bg-blue-50 grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <label className="block text-xs text-gray-600 mb-0.5">Name</label>
            <input className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-gray-600 mb-0.5">Price (USD)</label>
            <input type="number" min="0" step="0.01" className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
          </div>
          <div className="col-span-4">
            <label className="block text-xs text-gray-600 mb-0.5">Category</label>
            <select className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
              value={form.revenueCategory} onChange={e => setForm(f => ({ ...f, revenueCategory: e.target.value }))}>
              {REVENUE_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-1 pt-4">
            <button onClick={save} disabled={saving}
              className="px-3 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? '…' : 'Save'}
            </button>
            <button onClick={cancelEdit} className="px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300">✕</button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 py-6 text-center">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">No services found.</p>
      ) : (
        <div className="overflow-auto rounded-md border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-left">Category</th>
                <th className="px-3 py-2 text-center">Active</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => editingId === r.id ? (
                <tr key={r.id} className="bg-yellow-50">
                  <td className="px-2 py-1">
                    <input className="w-full border border-gray-300 rounded px-2 py-0.5 text-sm"
                      value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                  </td>
                  <td className="px-2 py-1">
                    <input type="number" min="0" step="0.01" className="w-24 border border-gray-300 rounded px-2 py-0.5 text-sm"
                      value={form.price} onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
                  </td>
                  <td className="px-2 py-1">
                    <select className="border border-gray-300 rounded px-2 py-0.5 text-sm"
                      value={form.revenueCategory} onChange={e => setForm(f => ({ ...f, revenueCategory: e.target.value }))}>
                      {REVENUE_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-center">
                    <input type="checkbox" checked={form.isActive}
                      onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  </td>
                  <td className="px-2 py-1">
                    <div className="flex gap-1 justify-end">
                      <button onClick={save} disabled={saving}
                        className="px-2 py-0.5 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                        {saving ? '…' : 'Save'}
                      </button>
                      <button onClick={cancelEdit} className="px-2 py-0.5 text-xs rounded bg-gray-200 hover:bg-gray-300">✕</button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">{r.name}</td>
                  <td className="px-3 py-2 text-right text-gray-700">${Number(r.price).toFixed(2)}</td>
                  <td className="px-3 py-2">
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {labelFor(r.revenueCategory)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggle(r)}
                      title={r.isActive ? 'Active — click to deactivate' : 'Inactive — click to activate'}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform ${r.isActive ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => startEdit(r)} disabled={editingId !== null}
                        className="px-2 py-0.5 text-xs rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40">
                        Edit
                      </button>
                      <button onClick={() => remove(r.id)} disabled={editingId !== null}
                        className="px-2 py-0.5 text-xs rounded border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40">
                        Del
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}

function ConsultationRooms() {
  const departments = useListStore(D.departmentsStore);
  const deptName = (id: string) => departments.find((d) => d.id === id)?.name ?? '—';
  const columns: ColumnDef<D.ConsultationRoom>[] = [
    { key: 'room', label: 'Room' },
    {
      key: 'departmentId',
      label: 'Department',
      type: 'select',
      options: departments.map((d) => ({ value: d.id, label: d.name })),
      render: (r) => deptName(r.departmentId),
    },
    { key: 'capacity', label: 'Capacity' },
    { key: 'status', label: 'Status', type: 'select', options: ['Available', 'In Use', 'Maintenance'] },
  ];
  return (
    <PanelShell title="Consultation Rooms" description="Room numbers, capacities, and assignments" hideFooter>
      <EditableTable
        store={D.roomsStore}
        columns={columns}
        addLabel="+ Add Room"
        entityName="Room"
        defaults={{ room: '', departmentId: departments[0]?.id ?? '', capacity: '1 patient', status: 'Available' }}
      />
    </PanelShell>
  );
}

function WardsBeds() {
  const navigate = useNavigate();
  const { data: wards = [], isLoading } = useQuery({
    queryKey: ['wards'],
    queryFn: () => wardsApi.getAll().then((r) => r.data ?? []),
  });

  return (
    <PanelShell title="Wards / Beds" description="Inpatient ward layout and bed management" hideFooter>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Live data from Bed Management. Manage wards and beds there.
        </p>
        <button
          onClick={() => navigate('/beds')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <ExternalLink size={14} />
          Manage Wards / Beds
        </button>
      </div>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : wards.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No wards yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2 font-semibold">Ward</th>
                <th className="px-4 py-2 font-semibold">Department</th>
                <th className="px-4 py-2 font-semibold">Total Beds</th>
                <th className="px-4 py-2 font-semibold">Occupied</th>
              </tr>
            </thead>
            <tbody>
              {wards.map((w: any) => (
                <tr key={w.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-2 font-medium text-gray-800">{w.name}</td>
                  <td className="px-4 py-2 text-gray-600">{w.department?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-gray-600">{w.totalBeds}</td>
                  <td className="px-4 py-2 text-gray-600">{w.occupied}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PanelShell>
  );
}

function WorkingHours() {
  const hours = useValueStore(D.workingHoursStore);
  return (
    <PanelShell title="Working Hours" description="Opening hours, holidays, and shift schedules" hideFooter>
      <WeeklyHoursEditor value={hours} onChange={(next) => D.workingHoursStore.replace(next)} />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Users & Access                                                     */
/* ------------------------------------------------------------------ */

// This panel used to manage its own mock user list (D.usersStore). It's
// been replaced with the real Staff Directory, which reads/writes the
// actual `users` table via usersApi — same accounts, same roles, same
// department data as the Staff page in the main sidebar. No more parallel
// fake user list to keep in sync with reality.
function Users() {
  return <StaffDirectoryPage />;
}

function Roles() {
  const queryClient = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await rolesApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await permissionsApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const [newRoleName, setNewRoleName] = useState('');

  const createMutation = useMutation({
    mutationFn: (name: string) => rolesApi.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setNewRoleName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  return (
    <PanelShell title="Roles" description="Real roles from your permissions system — these directly control what each account can access" hideFooter>
      <div className="mb-4 flex gap-2">
        <TextInput
          value={newRoleName}
          onChange={(e) => setNewRoleName(e.target.value)}
          placeholder="e.g. supervisor"
        />
        <button
          onClick={() => newRoleName.trim() && createMutation.mutate(newRoleName.trim())}
          disabled={!newRoleName.trim() || createMutation.isPending}
          className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          + Add Role
        </button>
      </div>
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {roles.map((r: any) => (
          <div key={r.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="text-sm font-medium capitalize text-gray-800">{r.name}</p>
              <p className="text-xs text-gray-400">
                {(r.permissions ?? []).length} of {permissions.length} permissions granted
              </p>
            </div>
            <button
              onClick={() => deleteMutation.mutate(r.id)}
              className="text-xs font-medium text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function Permissions() {
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await rolesApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await permissionsApi.getAll()).data ?? [],
    placeholderData: [],
  });

  return (
    <PanelShell title="Permissions" description="Every permission defined in the system, and which real roles currently grant it" hideFooter>
      <div className="overflow-x-auto rounded-md border border-gray-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 font-medium">Permission</th>
              {roles.map((r: any) => (
                <th key={r.id} className="px-3 py-2 text-center font-medium capitalize">{r.name}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {permissions.map((p: any) => (
              <tr key={p.id}>
                <td className="px-3 py-2 text-gray-800">{p.name}</td>
                {roles.map((r: any) => {
                  const granted = (r.permissions ?? []).some((rp: any) => rp.id === p.id);
                  return (
                    <td key={r.id} className="px-3 py-2 text-center">
                      {granted ? <span className="text-green-600">●</span> : <span className="text-gray-200">—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-400">To change a grant, use Role Permissions and pick the role.</p>
    </PanelShell>
  );
}

function DoctorAccounts() {
  const { data: users = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await usersApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const doctors = users.filter((u: any) => u.roles?.some((r: any) => r.name === 'doctor'));

  return (
    <PanelShell title="Doctor Accounts" description="Real accounts holding the 'doctor' role — edit position/department/roles from the Users panel" hideFooter>
      {doctors.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
          No accounts currently have the doctor role
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {doctors.map((d: any) => (
            <div key={d.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{d.firstName} {d.lastName}</p>
                <p className="text-xs text-gray-400">{d.position ?? 'No position set'}</p>
              </div>
              <span className="text-sm text-gray-600">{d.department?.name ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function StaffAccounts() {
  const { data: users = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await usersApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const nonDoctorStaff = users.filter(
    (u: any) => !u.roles?.some((r: any) => r.name === 'doctor' || r.name === 'administrator'),
  );

  return (
    <PanelShell title="Staff Accounts" description="Real accounts excluding doctors and administrators — edit from the Users panel" hideFooter>
      {nonDoctorStaff.length === 0 ? (
        <div className="rounded-md border border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
          No non-clinical staff accounts yet
        </div>
      ) : (
        <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
          {nonDoctorStaff.map((s: any) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{s.firstName} {s.lastName}</p>
                <p className="text-xs text-gray-400">{s.position ?? 'No position set'}</p>
              </div>
              <span className="text-sm text-gray-600">{s.department?.name ?? '—'}</span>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function DepartmentAssignments() {
  const { data: users = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: async () => (await usersApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const grouped = users.reduce((acc: Record<string, any[]>, u: any) => {
    const key = u.department?.name ?? 'Unassigned';
    acc[key] = acc[key] ?? [];
    acc[key].push(u);
    return acc;
  }, {});

  return (
    <PanelShell title="Department Assignments" description="Real accounts grouped by their assigned department — change assignment from the Users panel" hideFooter>
      <div className="space-y-4">
        {Object.entries(grouped).map(([deptName, people]) => (
          <div key={deptName} className="rounded-md border border-gray-200">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
              {deptName} <span className="font-normal text-gray-400">({people.length})</span>
            </div>
            <div className="divide-y divide-gray-100">
              {people.map((p: any) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-gray-800">{p.firstName} {p.lastName}</span>
                  <span className="text-gray-400">{p.position ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function RolePermissions() {
  const queryClient = useQueryClient();
  const { data: roles = [] } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await rolesApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const { data: permissions = [] } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => (await permissionsApi.getAll()).data ?? [],
    placeholderData: [],
  });
  const [roleId, setRoleId] = useState('');
  const activeRoleId = roles.some((r: any) => r.id === roleId) ? roleId : roles[0]?.id ?? '';
  const activeRole = roles.find((r: any) => r.id === activeRoleId);
  const granted = new Set((activeRole?.permissions ?? []).map((p: any) => p.id));

  const toggleMutation = useMutation({
    mutationFn: (permissionIds: string[]) => rolesApi.update(activeRoleId, { permissionIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  });

  function toggle(permId: string) {
    const next = new Set(granted);
    next.has(permId) ? next.delete(permId) : next.add(permId);
    toggleMutation.mutate(Array.from(next) as string[]);
  }

  return (
    <PanelShell title="Role Permissions" description="Toggling here immediately changes what that role's users can access — shares data with the Permissions grid" hideFooter>
      <Field label="Select Role">
        <SelectInput
          options={roles.map((r: any) => ({ value: r.id, label: r.name }))}
          value={activeRoleId}
          onChange={(e) => setRoleId(e.target.value)}
        />
      </Field>
      {activeRole?.name === 'administrator' && (
        <p className="mb-3 text-xs text-amber-600">
          Administrators bypass permission checks entirely — toggles here won't restrict them.
        </p>
      )}
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {permissions.map((p: any) => (
          <ToggleRow key={p.id} label={p.name} checked={granted.has(p.id)} onChange={() => toggle(p.id)} />
        ))}
      </div>
    </PanelShell>
  );
}

function LoginSessionSettings() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Record<string, any>>({});
  const [initialized, setInitialized] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings', 'login-session'],
    queryFn: () => loginSessionApi.get().then((res) => res.data),
  });

  if (settings && !initialized) {
    setForm({
      sessionTimeout: settings.sessionTimeout,
      maxLoginAttempts: settings.maxLoginAttempts,
      passwordExpiry: settings.passwordExpiry,
      minPasswordLength: settings.minPasswordLength,
      require2fa: settings.require2fa,
      forceChange: settings.forceChange,
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => loginSessionApi.update(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'login-session'] }),
  });

  const resetForm = () => settings && setForm({
    sessionTimeout: settings.sessionTimeout,
    maxLoginAttempts: settings.maxLoginAttempts,
    passwordExpiry: settings.passwordExpiry,
    minPasswordLength: settings.minPasswordLength,
    require2fa: settings.require2fa,
    forceChange: settings.forceChange,
  });

  if (isLoading || !initialized) {
    return <div className="text-sm text-clinical-400 py-6">Loading login / session settings…</div>;
  }

  return (
    <PanelShell title="Login / Session Settings" description="Security and session policy" onSave={() => saveMutation.mutate()} onReset={resetForm}>
      <FieldGrid>
        <Field label="Session Timeout (minutes)"><TextInput type="number" value={form.sessionTimeout ?? 0} onChange={(e) => setForm({ ...form, sessionTimeout: Number(e.target.value) })} /></Field>
        <Field label="Max Login Attempts"><TextInput type="number" value={form.maxLoginAttempts ?? 0} onChange={(e) => setForm({ ...form, maxLoginAttempts: Number(e.target.value) })} /></Field>
        <Field label="Password Expiry (days)"><TextInput type="number" value={form.passwordExpiry ?? 0} onChange={(e) => setForm({ ...form, passwordExpiry: Number(e.target.value) })} /></Field>
        <Field label="Minimum Password Length"><TextInput type="number" value={form.minPasswordLength ?? 0} onChange={(e) => setForm({ ...form, minPasswordLength: Number(e.target.value) })} /></Field>
      </FieldGrid>
      <ToggleRow label="Require Two-Factor Authentication" checked={!!form.require2fa} onChange={(v) => setForm({ ...form, require2fa: v })} />
      <ToggleRow label="Force Password Change on First Login" checked={!!form.forceChange} onChange={(v) => setForm({ ...form, forceChange: v })} />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Clinical Configuration                                             */
/* ------------------------------------------------------------------ */

function VitalRanges() {
  const columns: ColumnDef<D.VitalRange>[] = [
    { key: 'vital', label: 'Vital Sign' },
    { key: 'min', label: 'Normal Min' },
    { key: 'max', label: 'Normal Max' },
    { key: 'unit', label: 'Unit' },
  ];
  return (
    <PanelShell title="Vital Sign Ranges" description="Normal ranges used for flagging abnormal readings" hideFooter>
      <EditableTable store={D.vitalRangesStore} columns={columns} addLabel="+ Add Vital" entityName="Vital range" defaults={{ vital: '', min: '', max: '', unit: '' }} />
    </PanelShell>
  );
}

function DiagnosisCodes() {
  const [query, setQuery] = useState('');
  const columns: ColumnDef<D.DiagnosisCode>[] = [
    { key: 'code', label: 'Code' },
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
  ];
  return (
    <PanelShell title="Diagnosis Codes (ICD-10)" description="Diagnosis codes available when recording visits" hideFooter>
      <Field label="Search codes"><TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by code or description..." /></Field>
      <EditableTable
        store={D.diagnosisCodesStore}
        columns={columns}
        addLabel="+ Add Code"
        entityName="Diagnosis code"
        defaults={{ code: '', description: '', category: '' }}
        filterRows={(rows) =>
          rows.filter(
            (c) => c.code.toLowerCase().includes(query.toLowerCase()) || c.description.toLowerCase().includes(query.toLowerCase())
          )
        }
      />
    </PanelShell>
  );
}

function VisitTypes() {
  const columns: ColumnDef<D.VisitType>[] = [
    { key: 'name', label: 'Visit Type' },
    { key: 'duration', label: 'Default Duration' },
    { key: 'color', label: 'Color Tag', type: 'select', options: ['Blue', 'Green', 'Red', 'Purple', 'Orange'] },
  ];
  return (
    <PanelShell title="Visit Types" description="Categories used when registering a patient visit" hideFooter>
      <EditableTable store={D.visitTypesStore} columns={columns} addLabel="+ Add Visit Type" entityName="Visit type" defaults={{ name: '', duration: '', color: 'Blue' }} />
    </PanelShell>
  );
}

function ClinicalNoteTemplates() {
  const columns: ColumnDef<D.NoteTemplate>[] = [
    { key: 'name', label: 'Template' },
    { key: 'specialty', label: 'Specialty' },
    { key: 'lastUpdated', label: 'Last Updated' },
  ];
  return (
    <PanelShell title="Clinical Note Templates" description="Reusable templates doctors can start a note from" hideFooter>
      <EditableTable store={D.noteTemplatesStore} columns={columns} addLabel="+ Add Template" entityName="Template" defaults={{ name: '', specialty: '', lastUpdated: 'Just now' }} />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Pharmacy                                                            */
/* ------------------------------------------------------------------ */

function MedicinesCatalogSettings() {
  const categories = useListStore(D.medicineCategoriesStore);
  const { draft, patch, save, reset } = useDraft(D.medicinesCatalogDefaultsStore);
  return (
    <PanelShell title="Medicines Catalog" description="Defaults applied when adding medicines" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Default Unit of Measure">
          <SelectInput options={['Tablet', 'Capsule', 'Bottle', 'Vial', 'Box']} value={draft.defaultUnit} onChange={(e) => patch({ defaultUnit: e.target.value })} />
        </Field>
        <Field label="Default Category">
          <SelectInput
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
            value={draft.defaultCategoryId}
            onChange={(e) => patch({ defaultCategoryId: e.target.value })}
          />
        </Field>
      </FieldGrid>
      <ToggleRow label="Require Generic Name" description="Generic name must be entered for every medicine" checked={draft.requireGeneric} onChange={(v) => patch({ requireGeneric: v })} />
      <div className="pt-2">
        <p className="mb-2 text-sm font-medium text-gray-700">Medicine Categories</p>
        <EditableTable
          store={D.medicineCategoriesStore}
          columns={[{ key: 'name', label: 'Category' }]}
          addLabel="+ Add Category"
          entityName="Category"
          defaults={{ name: '' }}
        />
      </div>
    </PanelShell>
  );
}

function StockAlerts() {
  const { draft, patch, save, reset } = useDraft(D.stockAlertsStore);
  return (
    <PanelShell title="Stock Alerts" description="Thresholds that trigger low-stock and expiry warnings" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Low Stock Threshold" hint="Alert when quantity falls below this">
          <TextInput type="number" value={draft.lowStockThreshold} onChange={(e) => patch({ lowStockThreshold: Number(e.target.value) })} />
        </Field>
        <Field label="Expiry Alert (days before)">
          <TextInput type="number" value={draft.expiryAlertDays} onChange={(e) => patch({ expiryAlertDays: Number(e.target.value) })} />
        </Field>
      </FieldGrid>
    </PanelShell>
  );
}

function DispensingRules() {
  const rules = useValueStore(D.dispensingRulesStore);
  return (
    <PanelShell title="Dispensing Rules" description="Controls applied at the pharmacy counter" hideFooter>
      <ToggleRow label="Require Valid Prescription" checked={rules.requireRx} onChange={(v) => D.dispensingRulesStore.set({ requireRx: v })} />
      <ToggleRow label="Allow Partial Dispensing" checked={rules.allowPartial} onChange={(v) => D.dispensingRulesStore.set({ allowPartial: v })} />
      <ToggleRow
        label="Require Double-Check for Controlled Substances"
        checked={rules.requireDoubleCheck}
        onChange={(v) => D.dispensingRulesStore.set({ requireDoubleCheck: v })}
      />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Laboratory                                                          */
/* ------------------------------------------------------------------ */

function TestCatalog() {
  const navigate = useNavigate();
  const columns: ColumnDef<D.TestCatalogItem>[] = [
    { key: 'name', label: 'Test' },
    { key: 'category', label: 'Category' },
    { key: 'unit', label: 'Unit' },
    { key: 'referenceRange', label: 'Reference Range' },
    { key: 'price', label: 'Price ($)', type: 'number' },
    {
      key: 'id',
      label: 'Recipe',
      hideInForm: true,
      render: (row) => (
        <button
          type="button"
          onClick={() => navigate(`/settings/laboratory/tests/${row.id}/recipe`)}
          className="text-blue-600 hover:underline text-sm"
        >
          Recipe
        </button>
      ),
    },
  ];
  return (
    <PanelShell title="Test Catalog" description="Laboratory tests available for ordering — backed by the real catalog used when entering results" hideFooter>
      <EditableTable
        store={D.testCatalogStore}
        columns={columns}
        addLabel="+ Add Test"
        entityName="Test"
        defaults={{ name: '', category: '', unit: '', referenceRange: '', price: 0 }}
      />
    </PanelShell>
  );
}

function ReferenceRanges() {
  const columns: ColumnDef<D.ReferenceRange>[] = [
    { key: 'test', label: 'Test' },
    { key: 'sex', label: 'Sex', type: 'select', options: ['Male', 'Female', 'All'] },
    { key: 'range', label: 'Normal Range' },
    { key: 'unit', label: 'Unit' },
  ];
  return (
    <PanelShell title="Reference Ranges" description="Normal ranges used to flag lab results" hideFooter>
      <EditableTable store={D.referenceRangesStore} columns={columns} addLabel="+ Add Range" entityName="Range" defaults={{ test: '', sex: 'All', range: '', unit: '' }} />
    </PanelShell>
  );
}

function SampleTypes() {
  const columns: ColumnDef<D.SampleType>[] = [
    { key: 'name', label: 'Sample Type' },
    { key: 'container', label: 'Container' },
    { key: 'handling', label: 'Handling' },
  ];
  return (
    <PanelShell title="Sample Types" description="Collection and handling instructions" hideFooter>
      <EditableTable store={D.sampleTypesStore} columns={columns} addLabel="+ Add Sample Type" entityName="Sample type" defaults={{ name: '', container: '', handling: '' }} />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Radiology                                                           */
/* ------------------------------------------------------------------ */

function Modalities() {
  const columns: ColumnDef<D.Modality>[] = [
    { key: 'name', label: 'Modality' },
    { key: 'equipmentId', label: 'Equipment ID' },
    { key: 'status', label: 'Status', type: 'select', options: ['Operational', 'Under Maintenance', 'Offline'] },
  ];
  return (
    <PanelShell title="Modalities" description="Imaging equipment available at this facility" hideFooter>
      <EditableTable store={D.modalitiesStore} columns={columns} addLabel="+ Add Modality" entityName="Modality" defaults={{ name: '', equipmentId: '', status: 'Operational' }} />
    </PanelShell>
  );
}

function ProcedureTypes() {
  const modalities = useListStore(D.modalitiesStore);
  const modName = (id: string) => modalities.find((m) => m.id === id)?.name ?? '—';
  const columns: ColumnDef<D.ProcedureType>[] = [
    { key: 'name', label: 'Procedure' },
    {
      key: 'modalityId',
      label: 'Modality',
      type: 'select',
      options: modalities.map((m) => ({ value: m.id, label: m.name })),
      render: (r) => modName(r.modalityId),
    },
    { key: 'duration', label: 'Duration' },
    { key: 'prep', label: 'Prep Instructions' },
  ];
  return (
    <PanelShell title="Procedure Types" description="Default duration and prep instructions per procedure" hideFooter>
      <EditableTable
        store={D.procedureTypesStore}
        columns={columns}
        addLabel="+ Add Procedure"
        entityName="Procedure"
        defaults={{ name: '', modalityId: modalities[0]?.id ?? '', duration: '', prep: '' }}
      />
    </PanelShell>
  );
}

function RadiologyReportTemplates() {
  const modalities = useListStore(D.modalitiesStore);
  const modName = (id: string) => modalities.find((m) => m.id === id)?.name ?? '—';
  const columns: ColumnDef<D.RadiologyTemplate>[] = [
    { key: 'name', label: 'Template' },
    {
      key: 'modalityId',
      label: 'Modality',
      type: 'select',
      options: modalities.map((m) => ({ value: m.id, label: m.name })),
      render: (r) => modName(r.modalityId),
    },
    { key: 'lastUpdated', label: 'Last Updated' },
  ];
  return (
    <PanelShell title="Report Templates" description="Structured templates radiologists report against" hideFooter>
      <EditableTable
        store={D.radiologyTemplatesStore}
        columns={columns}
        addLabel="+ Add Template"
        entityName="Template"
        defaults={{ name: '', modalityId: modalities[0]?.id ?? '', lastUpdated: 'Just now' }}
      />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Appointment Settings                                                */
/* ------------------------------------------------------------------ */

function AppointmentTypes() {
  const columns: ColumnDef<D.AppointmentType>[] = [
    { key: 'name', label: 'Type' },
    { key: 'durationMinutes', label: 'Default Duration (min)', type: 'number' },
    { key: 'color', label: 'Color', type: 'select', options: ['Blue', 'Green', 'Orange', 'Red', 'Purple'] },
    { key: 'requiresDoctor', label: 'Requires Doctor', type: 'boolean' },
  ];
  return (
    <PanelShell title="Appointment Types" description="New, follow-up, procedure, urgent — durations here drive the Appointment Duration panel too" hideFooter>
      <EditableTable
        store={D.appointmentTypesStore}
        columns={columns}
        addLabel="+ Add Type"
        entityName="Appointment type"
        defaults={{ name: '', durationMinutes: 15, color: 'Blue', requiresDoctor: true }}
      />
    </PanelShell>
  );
}

function AppointmentDuration() {
  const types = useListStore(D.appointmentTypesStore);
  return (
    <PanelShell title="Appointment Duration" description="Default slot length by type — shares data with Appointment Types" hideFooter>
      <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
        {types.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <span className="text-sm font-medium text-gray-800">{t.name}</span>
            <div className="flex items-center gap-2">
              <TextInput
                type="number"
                className="w-24"
                value={t.durationMinutes}
                onChange={(e) => D.appointmentTypesStore.update(t.id, { durationMinutes: Number(e.target.value) })}
              />
              <span className="text-xs text-gray-400">minutes</span>
            </div>
          </div>
        ))}
      </div>
    </PanelShell>
  );
}

function DoctorSchedules() {
  const doctors = useListStore(D.doctorAccountsStore);
  const [doctorId, setDoctorId] = useState(doctors[0]?.id ?? '');
  const activeId = doctors.some((d) => d.id === doctorId) ? doctorId : doctors[0]?.id ?? '';
  const schedules = useValueStore(D.doctorSchedulesStore);
  const value = schedules[activeId] ?? { closedDays: ['Sunday'], hours: {}, holidays: '' };
  return (
    <PanelShell title="Doctor Schedules" description="Per-doctor availability and time blocks" hideFooter>
      <Field label="Doctor">
        <SelectInput options={doctors.map((d) => ({ value: d.id, label: d.name }))} value={activeId} onChange={(e) => setDoctorId(e.target.value)} />
      </Field>
      <WeeklyHoursEditor value={value} onChange={(next) => D.doctorSchedulesStore.set({ [activeId]: next })} />
    </PanelShell>
  );
}

function DepartmentSchedules() {
  const departments = useListStore(D.departmentsStore);
  const [deptId, setDeptId] = useState(departments[0]?.id ?? '');
  const activeId = departments.some((d) => d.id === deptId) ? deptId : departments[0]?.id ?? '';
  const schedules = useValueStore(D.departmentSchedulesStore);
  const value = schedules[activeId] ?? { closedDays: ['Sunday'], hours: {}, holidays: '' };
  return (
    <PanelShell title="Department Schedules" description="Department-level opening slots" hideFooter>
      <Field label="Department">
        <SelectInput options={departments.map((d) => ({ value: d.id, label: d.name }))} value={activeId} onChange={(e) => setDeptId(e.target.value)} />
      </Field>
      <WeeklyHoursEditor value={value} onChange={(next) => D.departmentSchedulesStore.set({ [activeId]: next })} />
    </PanelShell>
  );
}

function BookingRules() {
  const { draft, patch, save, reset } = useDraft(D.bookingRulesStore);
  return (
    <PanelShell title="Booking Rules" description="Advance booking limits and restrictions" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Advance Booking Limit (days)"><TextInput type="number" value={draft.advanceBookingLimit} onChange={(e) => patch({ advanceBookingLimit: Number(e.target.value) })} /></Field>
        <Field label="Minimum Notice (hours)"><TextInput type="number" value={draft.minNoticeHours} onChange={(e) => patch({ minNoticeHours: Number(e.target.value) })} /></Field>
        <Field label="Max Appointments per Patient/Day"><TextInput type="number" value={draft.maxPerPatientPerDay} onChange={(e) => patch({ maxPerPatientPerDay: Number(e.target.value) })} /></Field>
      </FieldGrid>
      <ToggleRow label="Allow Same-Day Booking" checked={draft.allowSameDay} onChange={(v) => patch({ allowSameDay: v })} />
    </PanelShell>
  );
}

function CancellationRules() {
  const { draft, patch, save, reset } = useDraft(D.cancellationRulesStore);
  return (
    <PanelShell title="Cancellation Rules" description="Cancellation window and penalties" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Cancellation Window (hours before)"><TextInput type="number" value={draft.cancellationWindowHours} onChange={(e) => patch({ cancellationWindowHours: Number(e.target.value) })} /></Field>
        <Field label="Late-Cancellation Fee"><TextInput value={draft.lateFee} onChange={(e) => patch({ lateFee: e.target.value })} placeholder="e.g. $5 or 10%" /></Field>
      </FieldGrid>
      <ToggleRow label="Allow Patients to Self-Cancel" checked={draft.allowSelfCancel} onChange={(v) => patch({ allowSelfCancel: v })} />
    </PanelShell>
  );
}

function ReschedulingRules() {
  const { draft, patch, save, reset } = useDraft(D.reschedulingRulesStore);
  return (
    <PanelShell title="Rescheduling Rules" description="How and when reschedules are allowed" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Max Reschedules Allowed"><TextInput type="number" value={draft.maxReschedules} onChange={(e) => patch({ maxReschedules: Number(e.target.value) })} /></Field>
        <Field label="Reschedule Window (hours before)"><TextInput type="number" value={draft.rescheduleWindowHours} onChange={(e) => patch({ rescheduleWindowHours: Number(e.target.value) })} /></Field>
      </FieldGrid>
      <ToggleRow label="Require a Reason When Rescheduling" checked={draft.requireReason} onChange={(v) => patch({ requireReason: v })} />
    </PanelShell>
  );
}

function OnlineBooking() {
  const { draft, patch, save, reset } = useDraft(D.onlineBookingStore);
  return (
    <PanelShell title="Online Booking" description="Patient self-booking portal settings" onSave={save} onReset={reset}>
      <ToggleRow label="Enable Online Booking" checked={draft.enabled} onChange={(v) => patch({ enabled: v })} />
      <ToggleRow label="Require Account Verification" checked={draft.requireVerify} onChange={(v) => patch({ requireVerify: v })} />
      <FieldGrid>
        <Field label="Booking Horizon (days ahead)"><TextInput type="number" value={draft.bookingHorizonDays} onChange={(e) => patch({ bookingHorizonDays: Number(e.target.value) })} /></Field>
        <Field label="Visible Doctors">
          <SelectInput options={['All Doctors', 'Selected Doctors Only']} value={draft.visibleDoctors} onChange={(e) => patch({ visibleDoctors: e.target.value })} />
        </Field>
      </FieldGrid>
    </PanelShell>
  );
}

function AppointmentReminders() {
  const { draft, patch, save, reset } = useDraft(D.appointmentRemindersStore);
  return (
    <PanelShell title="Appointment Reminders" description="SMS/email reminder schedule" onSave={save} onReset={reset}>
      <ToggleRow label="Send SMS Reminder" checked={draft.sms} onChange={(v) => patch({ sms: v })} />
      <ToggleRow label="Send Email Reminder" checked={draft.email} onChange={(v) => patch({ email: v })} />
      <FieldGrid>
        <Field label="First Reminder (hours before)"><TextInput type="number" value={draft.firstReminderHours} onChange={(e) => patch({ firstReminderHours: Number(e.target.value) })} /></Field>
        <Field label="Second Reminder (hours before)"><TextInput type="number" value={draft.secondReminderHours} onChange={(e) => patch({ secondReminderHours: Number(e.target.value) })} /></Field>
      </FieldGrid>
      <Field label="Reminder Message Template" full>
        <TextArea value={draft.template} onChange={(e) => patch({ template: e.target.value })} />
      </Field>
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Queue Management                                                    */
/* ------------------------------------------------------------------ */

function QueueDisplay() {
  const { draft, patch, save, reset } = useDraft(D.queueDisplayStore);
  return (
    <PanelShell title="Queue Display" description="Screen, TV, and call behavior" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Display Type">
          <SelectInput options={['Screen + TV', 'Screen Only', 'Audio Only']} value={draft.displayType} onChange={(e) => patch({ displayType: e.target.value })} />
        </Field>
        <Field label="Call Interval (seconds)"><TextInput type="number" value={draft.callIntervalSeconds} onChange={(e) => patch({ callIntervalSeconds: Number(e.target.value) })} /></Field>
      </FieldGrid>
      <ToggleRow label="Auto Call Next Patient" checked={draft.autoCall} onChange={(v) => patch({ autoCall: v })} />
    </PanelShell>
  );
}

function QueueCategories() {
  const state = useValueStore(D.queueCategoriesStore);
  return (
    <PanelShell title="Queue Categories" description="Which stages appear on the queue board" hideFooter>
      <ChecklistGrid
        allOptions={D.QUEUE_STAGE_OPTIONS}
        selected={state.activeStages}
        onChange={(activeStages) => D.queueCategoriesStore.set({ activeStages })}
      />
    </PanelShell>
  );
}

function PriorityRules() {
  const rules = useValueStore(D.priorityRulesStore);
  return (
    <PanelShell title="Priority Rules" description="Who jumps the queue and when" hideFooter>
      <ToggleRow label="Emergency Cases Get Top Priority" checked={rules.emergencyTopPriority} onChange={(v) => D.priorityRulesStore.set({ emergencyTopPriority: v })} />
      <ToggleRow label="Elderly Patients Get Priority" checked={rules.elderlyPriority} onChange={(v) => D.priorityRulesStore.set({ elderlyPriority: v })} />
      <ToggleRow
        label="Appointment Holders Priority Over Walk-ins"
        checked={rules.appointmentHoldersPriority}
        onChange={(v) => D.priorityRulesStore.set({ appointmentHoldersPriority: v })}
      />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Billing & Finance                                                   */
/* ------------------------------------------------------------------ */

function GeneralBilling() {
  const { draft, patch, save, reset } = useDraft(D.generalBillingStore);
  return (
    <PanelShell title="General Billing" description="Currency, tax, and invoicing defaults" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Currency">
          <SelectInput options={['USD (US Dollar)', 'SOS (Somali Shilling)', 'SLSH (Somaliland Shilling)']} value={draft.currency} onChange={(e) => patch({ currency: e.target.value })} />
        </Field>
        <Field label="Tax Rate (%)"><TextInput type="number" value={draft.taxRate} onChange={(e) => patch({ taxRate: Number(e.target.value) })} /></Field>
        <Field label="Invoice Number Prefix"><TextInput value={draft.invoicePrefix} onChange={(e) => patch({ invoicePrefix: e.target.value })} /></Field>
        <Field label="Invoice Due (days)"><TextInput type="number" value={draft.invoiceDueDays} onChange={(e) => patch({ invoiceDueDays: Number(e.target.value) })} /></Field>
      </FieldGrid>
    </PanelShell>
  );
}

function PaymentMethods() {
  const state = useValueStore(D.paymentMethodsStore);
  return (
    <PanelShell title="Payment Methods" description="Accepted ways patients can pay" hideFooter>
      <ChecklistGrid allOptions={D.PAYMENT_METHOD_OPTIONS} selected={state.accepted} onChange={(accepted) => D.paymentMethodsStore.set({ accepted })} />
    </PanelShell>
  );
}

function InsuranceProviders() {
  const queryClient = useQueryClient();
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['insuranceProviders'],
    queryFn: async () => (await insuranceProvidersApi.getAll()).data ?? [],
    placeholderData: [],
  });

  const columns: ColumnDef<any>[] = [
    { key: 'name', label: 'Provider' },
    { key: 'coverage', label: 'Coverage' },
    { key: 'contact', label: 'Contact' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  ];

  const store = {
    getSnapshot: () => providers,
    subscribe: () => () => {},
    add: async (item: any) => {
      await insuranceProvidersApi.create(item);
      queryClient.invalidateQueries({ queryKey: ['insuranceProviders'] });
    },
    update: async (id: string, patch: any) => {
      await insuranceProvidersApi.update(id, patch);
      queryClient.invalidateQueries({ queryKey: ['insuranceProviders'] });
    },
    remove: async (id: string) => {
      await insuranceProvidersApi.remove(id);
      queryClient.invalidateQueries({ queryKey: ['insuranceProviders'] });
    },
  };

  return (
    <PanelShell title="Insurance Providers" description="Providers accepted and their coverage terms" hideFooter>
      {isLoading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : (
        <EditableTable
          store={store as any}
          columns={columns}
          addLabel="+ Add Provider"
          entityName="Provider"
          defaults={{ name: '', coverage: '', contact: '', status: 'Active' }}
        />
      )}
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Inventory                                                           */
/* ------------------------------------------------------------------ */

function StockSettings() {
  const { draft, patch, save, reset } = useDraft(D.stockSettingsStore);
  return (
    <PanelShell title="Stock Settings" description="Inventory-wide defaults" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Default Reorder Threshold"><TextInput type="number" value={draft.defaultReorderThreshold} onChange={(e) => patch({ defaultReorderThreshold: Number(e.target.value) })} /></Field>
        <Field label="Default Unit of Measure">
          <SelectInput options={['Piece', 'Box', 'Pack', 'Carton']} value={draft.defaultUnit} onChange={(e) => patch({ defaultUnit: e.target.value })} />
        </Field>
      </FieldGrid>
      <ToggleRow label="Enable Auto-Reorder" description="Automatically raise a purchase order at threshold" checked={draft.autoReorder} onChange={(v) => patch({ autoReorder: v })} />
    </PanelShell>
  );
}

function Suppliers() {
  const columns: ColumnDef<D.Supplier>[] = [
    { key: 'name', label: 'Supplier' },
    { key: 'contact', label: 'Contact' },
    { key: 'itemsSupplied', label: 'Items Supplied' },
    { key: 'status', label: 'Status', type: 'select', options: ['Active', 'Inactive'] },
  ];
  return (
    <PanelShell title="Suppliers" description="Vendors used for stock replenishment" hideFooter>
      <EditableTable
        store={D.suppliersStore}
        columns={columns}
        addLabel="+ Add Supplier"
        entityName="Supplier"
        defaults={{ name: '', contact: '', itemsSupplied: '', status: 'Active' }}
      />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Printing                                                            */
/* ------------------------------------------------------------------ */

function PrinterSettings() {
  const { draft, patch, save, reset } = useDraft(D.printerSettingsStore);
  return (
    <PanelShell title="Printer Settings" description="Configure printers for receipts and prescriptions" onSave={save} onReset={reset}>
      <FieldGrid>
        <Field label="Printer Type">
          <SelectInput
            options={['Thermal / Receipt Printer', 'Laser Printer', 'Inkjet Printer']}
            value={draft.printerType}
            onChange={(e) => patch({ printerType: e.target.value })}
          />
        </Field>
        <Field label="Default Printer">
          <SelectInput options={['HP LaserJet Pro', 'Epson TM-T88', 'Canon PIXMA']} value={draft.defaultPrinter} onChange={(e) => patch({ defaultPrinter: e.target.value })} />
        </Field>
      </FieldGrid>
      <ToggleRow label="Auto Print Prescriptions" checked={draft.autoPrintRx} onChange={(v) => patch({ autoPrintRx: v })} />
      <ToggleRow label="Auto Print Receipts" checked={draft.autoPrintReceipt} onChange={(v) => patch({ autoPrintReceipt: v })} />
      <ToggleRow label="Print Patient Card on Registration" checked={draft.printCardOnRegistration} onChange={(v) => patch({ printCardOnRegistration: v })} />
    </PanelShell>
  );
}

function DocumentTemplates() {
  const columns: ColumnDef<D.DocumentTemplate>[] = [
    { key: 'name', label: 'Document' },
    { key: 'lastUpdated', label: 'Last Updated' },
  ];
  return (
    <PanelShell title="Document Templates" description="Printable templates used across the system" hideFooter>
      <EditableTable store={D.documentTemplatesStore} columns={columns} addLabel="+ Add Template" entityName="Template" defaults={{ name: '', lastUpdated: 'Just now' }} />
    </PanelShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Category / panel registry                                          */
/* ------------------------------------------------------------------ */

interface PanelDef {
  id: string;
  title: string;
  description: string;
  Component: () => JSX.Element;
}

interface CategoryDef {
  id: string;
  label: string;
  panels: PanelDef[];
}

/* ── Icon maps ─────────────────────────────────── */
const PANEL_ICONS: Record<string, React.ElementType> = {
  'facility-info': Building2,    'branches': GitBranch,        'departments': LayoutGrid,
  'services': Stethoscope,       'consultation-rooms': Wrench,  'wards-beds': BedDouble,
  'working-hours': Clock,        'users': UsersIcon,            'roles': ShieldCheck,
  'permissions': Lock,           'staff': UserCheck,            'visit-types': Stethoscope,
  'vital-ranges': BarChart3,     'note-templates': FileText,    'diagnoses': Microscope,
  'drug-categories': Pill,       'dosage-forms': Layers,        'units': Tag,
  'test-catalog': FlaskConical,  'reference-ranges': TestTube2, 'sample-types': Microscope,
  'modalities': Scan,            'procedure-types': Radio,      'radiology-templates': FileText,
  'appt-types': CalendarDays,    'appt-duration': Clock,        'doctor-schedules': UserCheck,
  'dept-schedules': LayoutGrid,  'booking-rules': ShieldCheck,  'cancellation-rules': FileText,
  'reschedule-rules': FileText,  'online-booking': Globe,       'reminders': Bell,
  'queue-display': ListOrdered,  'queue-categories': Tag,       'priority-rules': ShieldCheck,
  'general-billing': DollarSign, 'payment-methods': CreditCard, 'insurance': Receipt,
  'stock-settings': Package,     'suppliers': Truck,            'printer-settings': Printer,
  'doc-templates': FileText,     'backup-restore': Database, 'reset-data': Database,
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  'facility': Building2,      'users': UsersIcon,       'clinical': Stethoscope,
  'pharmacy': Pill,           'laboratory': FlaskConical,'radiology': Scan,
  'appointments': CalendarDays,'queue': ListOrdered,    'billing': Receipt,
  'inventory': Package,       'printing': Printer,      'system': Database,
};


const CATEGORIES: CategoryDef[] = [
  {
    id: 'facility',
    label: 'Facility & Organization',
    panels: [
      { id: 'facility-info', title: 'Facility Information', description: 'Name, logo, address, contact details', Component: FacilityInformation },
      { id: 'branches', title: 'Branches', description: 'Manage clinic branches or satellite locations', Component: Branches },
      { id: 'departments', title: 'Departments', description: 'Clinical and admin department structure', Component: Departments },
      { id: 'services', title: 'Services', description: 'Services offered by the facility', Component: Services },
      { id: 'rooms', title: 'Consultation Rooms', description: 'Room numbers, capacities, and assignments', Component: ConsultationRooms },
      { id: 'wards', title: 'Wards / Beds', description: 'Inpatient ward layout and bed management', Component: WardsBeds },
      { id: 'hours', title: 'Working Hours', description: 'Opening hours, holidays, and shift schedules', Component: WorkingHours },
    ],
  },
  {
    id: 'users',
    label: 'Users & Access',
    panels: [
      { id: 'users', title: 'Users', description: 'Manage system user accounts', Component: Users },
      { id: 'roles', title: 'Roles', description: 'Real roles and their permission counts', Component: Roles },
      { id: 'permissions', title: 'Permissions', description: 'Full permission x role grant matrix', Component: Permissions },
      { id: 'doctor-accounts', title: 'Doctor Accounts', description: 'Real accounts with the doctor role', Component: DoctorAccounts },
      { id: 'staff-accounts', title: 'Staff Accounts', description: 'Real non-clinical staff accounts', Component: StaffAccounts },
      { id: 'dept-assignments', title: 'Department Assignments', description: 'Real accounts grouped by department', Component: DepartmentAssignments },
      { id: 'role-permissions', title: 'Role Permissions', description: 'Fine-tune permissions for a single role', Component: RolePermissions },
      { id: 'login-session', title: 'Login / Session Settings', description: 'Security and session policy', Component: LoginSessionSettings },
    ],
  },
  {
    id: 'clinical',
    label: 'Clinical Configuration',
    panels: [
      { id: 'vitals', title: 'Vital Sign Ranges', description: 'Normal ranges used for flagging results', Component: VitalRanges },
      { id: 'diagnosis-codes', title: 'Diagnosis Codes (ICD-10)', description: 'Codes available when recording visits', Component: DiagnosisCodes },
      { id: 'visit-types', title: 'Visit Types', description: 'Categories used when registering a visit', Component: VisitTypes },
      { id: 'note-templates', title: 'Clinical Note Templates', description: 'Reusable templates for doctors', Component: ClinicalNoteTemplates },
    ],
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    panels: [
      { id: 'medicine-catalog', title: 'Medicines Catalog', description: 'Defaults for adding medicines', Component: MedicinesCatalogSettings },
      { id: 'stock-alerts', title: 'Stock Alerts', description: 'Low-stock and expiry alert thresholds', Component: StockAlerts },
      { id: 'dispensing-rules', title: 'Dispensing Rules', description: 'Controls at the pharmacy counter', Component: DispensingRules },
    ],
  },
  {
    id: 'laboratory',
    label: 'Laboratory',
    panels: [
      { id: 'test-catalog', title: 'Test Catalog', description: 'Tests available for ordering', Component: TestCatalog },
    ],
  },
  {
    id: 'radiology',
    label: 'Radiology',
    panels: [
      { id: 'modalities', title: 'Modalities', description: 'Imaging equipment available', Component: Modalities },
      { id: 'procedure-types', title: 'Procedure Types', description: 'Duration and prep per procedure', Component: ProcedureTypes },
      { id: 'radiology-templates', title: 'Report Templates', description: 'Structured reporting templates', Component: RadiologyReportTemplates },
    ],
  },
  {
    id: 'appointments',
    label: 'Appointment Settings',
    panels: [
      { id: 'appt-types', title: 'Appointment Types', description: 'New, follow-up, procedure, urgent', Component: AppointmentTypes },
      { id: 'appt-duration', title: 'Appointment Duration', description: 'Default slot lengths by type', Component: AppointmentDuration },
      { id: 'doctor-schedules', title: 'Doctor Schedules', description: 'Per-doctor availability and time blocks', Component: DoctorSchedules },
      { id: 'dept-schedules', title: 'Department Schedules', description: 'Department-level opening slots', Component: DepartmentSchedules },
      { id: 'booking-rules', title: 'Booking Rules', description: 'Advance booking limits, restrictions', Component: BookingRules },
      { id: 'cancellation-rules', title: 'Cancellation Rules', description: 'Cancellation window and penalties', Component: CancellationRules },
      { id: 'reschedule-rules', title: 'Rescheduling Rules', description: 'How and when to allow reschedules', Component: ReschedulingRules },
      { id: 'online-booking', title: 'Online Booking', description: 'Patient self-booking portal settings', Component: OnlineBooking },
      { id: 'reminders', title: 'Appointment Reminders', description: 'SMS/email reminder schedule', Component: AppointmentReminders },
    ],
  },
  {
    id: 'queue',
    label: 'Queue Management',
    panels: [
      { id: 'queue-display', title: 'Queue Display', description: 'Screen, TV, and call behavior', Component: QueueDisplay },
      { id: 'queue-categories', title: 'Queue Categories', description: 'Stages shown on the queue board', Component: QueueCategories },
      { id: 'priority-rules', title: 'Priority Rules', description: 'Who jumps the queue and when', Component: PriorityRules },
    ],
  },
  {
    id: 'billing',
    label: 'Billing & Finance',
    panels: [
      { id: 'general-billing', title: 'General Billing', description: 'Currency, tax, and invoicing defaults', Component: GeneralBilling },
      { id: 'payment-methods', title: 'Payment Methods', description: 'Accepted ways patients can pay', Component: PaymentMethods },
      { id: 'insurance', title: 'Insurance Providers', description: 'Providers accepted and coverage terms', Component: InsuranceProviders },
    ],
  },
  {
    id: 'inventory',
    label: 'Inventory',
    panels: [
      { id: 'stock-settings', title: 'Stock Settings', description: 'Inventory-wide defaults', Component: StockSettings },
      { id: 'suppliers', title: 'Suppliers', description: 'Vendors used for stock replenishment', Component: Suppliers },
    ],
  },
  {
    id: 'printing',
    label: 'Printing',
    panels: [
      { id: 'printer-settings', title: 'Printer Settings', description: 'Printers for receipts and prescriptions', Component: PrinterSettings },
      { id: 'doc-templates', title: 'Document Templates', description: 'Printable templates used system-wide', Component: DocumentTemplates },
    ],
  },
  {
    id: 'system',
    label: 'System',
    panels: [
      { id: 'backup-restore', title: 'Backup & Restore', description: 'Full database backup and restore', Component: BackupRestorePage },
      { id: 'reset-data', title: 'Reset Data', description: 'Clear records or return the app to a new state', Component: ResetDataPage },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Page shell                                                          */
/* ------------------------------------------------------------------ */

function SettingsPageInner() {
  const [categoryId, setCategoryId] = useState(CATEGORIES[0].id);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const activeCategory = CATEGORIES.find((c) => c.id === categoryId)!;
  const [panelId, setPanelId] = useState(activeCategory.panels[0].id);
  const activePanel = activeCategory.panels.find((p) => p.id === panelId) ?? activeCategory.panels[0];
  const ActiveComponent = activePanel.Component;

  function selectCategory(id: string) {
    if (id === categoryId) {
      setCollapsedCategories((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
    } else {
      setCategoryId(id);
      setCollapsedCategories((prev) => { const next = new Set(prev); next.delete(id); return next; });
      setPanelId(CATEGORIES.find((c) => c.id === id)!.panels[0].id);
    }
  }

  return (
    <div className="flex h-full bg-gray-50">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-gray-200 bg-white">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-blue-600" />
            <span className="text-[13px] font-semibold text-gray-700 tracking-wide uppercase">Settings</span>
          </div>
        </div>
        <nav className="py-2">
          {CATEGORIES.map((cat) => {
            const CatIcon = CATEGORY_ICONS[cat.id] ?? Cpu;
            const isActive = cat.id === categoryId;
            const isCollapsed = collapsedCategories.has(cat.id);
            return (
              <div key={cat.id} className="mb-0.5">
                <button
                  onClick={() => selectCategory(cat.id)}
                  className={`group flex items-center gap-2.5 px-3 py-2 text-left rounded-md mx-1 transition-colors duration-100 ${isActive ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <CatIcon className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  <span className="flex-1 text-[13px] font-semibold">{cat.label}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); setCollapsedCategories((prev) => { const next = new Set(prev); next.has(cat.id) ? next.delete(cat.id) : next.add(cat.id); return next; }); }}
                    className="opacity-50 hover:opacity-100 transition-opacity"
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>
                {!isCollapsed && (
                  <div className="mt-0.5 mb-1 space-y-px">
                    {cat.panels.map((p) => {
                      const PIcon = PANEL_ICONS[p.id] ?? FileText;
                      const isPanelActive = isActive && p.id === panelId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => { setCategoryId(cat.id); setPanelId(p.id); setCollapsedCategories((prev) => { const next = new Set(prev); next.delete(cat.id); return next; }); }}
                          className={`flex w-full items-center gap-2.5 pl-9 pr-3 py-1.5 text-left text-[12.5px] rounded-sm transition-colors ${isPanelActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'}`}
                        >
                          <PIcon className={`h-3.5 w-3.5 shrink-0 ${isPanelActive ? 'text-blue-500' : 'text-gray-400'}`} />
                          <span className="truncate">{p.title}</span>
                          {isPanelActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <div className="mb-5 flex items-center gap-1.5 text-xs text-gray-400">
          <Settings2 className="h-3.5 w-3.5" />
          <span>Settings</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-600 font-medium">{activeCategory.label}</span>
          <ChevronRight className="h-3 w-3" />
          <span className="text-blue-600 font-semibold">{activePanel.title}</span>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeCategory.panels.map((p) => {
            const PIcon = PANEL_ICONS[p.id] ?? FileText;
            const isSelected = p.id === panelId;
            return (
              <button
                key={p.id}
                onClick={() => setPanelId(p.id)}
                className={`group relative flex items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-150 ${isSelected ? 'border-blue-400 bg-white shadow-sm ring-1 ring-blue-200' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}`}
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${isSelected ? 'bg-blue-600' : 'bg-gray-100 group-hover:bg-gray-200'}`}>
                  <PIcon className={`h-4 w-4 ${isSelected ? 'text-white' : 'text-gray-500'}`} />
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-semibold truncate ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>{p.title}</p>
                  <p className="mt-0.5 text-xs text-gray-400 leading-snug line-clamp-2">{p.description}</p>
                </div>
                {isSelected && <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-blue-500" />}
              </button>
            );
          })}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
            {(() => { const PIcon = PANEL_ICONS[activePanel.id] ?? FileText; return <PIcon className="h-4 w-4 text-blue-600 shrink-0" />; })()}
            <div>
              <h2 className="text-sm font-semibold text-gray-900">{activePanel.title}</h2>
              <p className="text-xs text-gray-400">{activePanel.description}</p>
            </div>
          </div>
          <div className="p-5">
            <ActiveComponent key={activePanel.id} />
          </div>
        </div>
      </main>
    </div>
  );
}


export function SettingsPage() {
  return (
    <ToastProvider>
      <SettingsPageInner />
    </ToastProvider>
  );
}
