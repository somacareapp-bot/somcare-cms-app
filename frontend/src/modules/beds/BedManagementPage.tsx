import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useListStore } from '../../stores/store';
import { patientsApi } from '../../services/api';
import * as D from '../../stores/settingsData';

/* ─────────────────────────────────────────────────────────────────────────────
   Status colours
───────────────────────────────────────────────────────────────────────────── */
const STATUS_CARD: Record<D.Bed['status'], string> = {
  Available:   'border-emerald-200 bg-emerald-50',
  Occupied:    'border-orange-200  bg-orange-50',
  Maintenance: 'border-gray-200    bg-gray-50',
};
const STATUS_BADGE: Record<D.Bed['status'], string> = {
  Available:   'bg-emerald-100 text-emerald-700 border-emerald-200',
  Occupied:    'bg-orange-100  text-orange-700  border-orange-200',
  Maintenance: 'bg-gray-100   text-gray-500    border-gray-200',
};

function Badge({ status }: { status: D.Bed['status'] }) {
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_BADGE[status]}`}>
      {status}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Add / Edit modal
───────────────────────────────────────────────────────────────────────────── */
const EMPTY: Omit<D.Bed, 'id'> = {
  bedNumber: '',
  wardId: '',
  floor: 1,
  dailyRate: 0,
  status: 'Available',
  patientId: '',
  notes: '',
};

function BedModal({
  wards,
  patients,
  initial,
  onSave,
  onClose,
}: {
  wards: D.Ward[];
  patients: { id: string; name: string; code: string }[];
  initial: Partial<D.Bed> & Omit<D.Bed, 'id'>;
  onSave: (data: Partial<D.Bed> & Omit<D.Bed, 'id'>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState(initial);
  const patch = (p: Partial<typeof form>) =>
    setForm((f) => {
      const next = { ...f, ...p };
      // clear patient when not Occupied
      if (p.status && p.status !== 'Occupied') next.patientId = '';
      return next;
    });

  const isEdit = Boolean((form as D.Bed).id);
  const inputCls =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Bed' : 'Add Bed'}
          </h2>
          <button onClick={onClose} className="text-2xl leading-none text-gray-400 hover:text-gray-600">
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {/* Bed Number */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Bed Number <span className="text-red-500">*</span>
            </label>
            <input
              className={inputCls}
              placeholder="e.g. GA-01"
              value={form.bedNumber}
              onChange={(e) => patch({ bedNumber: e.target.value })}
            />
          </div>

          {/* Ward + Floor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Ward <span className="text-red-500">*</span>
              </label>
              <select
                className={inputCls}
                value={form.wardId}
                onChange={(e) => patch({ wardId: e.target.value })}
              >
                <option value="">Select Ward</option>
                {wards.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Floor</label>
              <input
                type="number"
                min={1}
                className={inputCls}
                value={form.floor}
                onChange={(e) => patch({ floor: Number(e.target.value) })}
              />
            </div>
          </div>

          {/* Daily Rate */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Daily Rate ($)</label>
            <input
              type="number"
              min={0}
              step={0.01}
              className={inputCls}
              value={form.dailyRate}
              onChange={(e) => patch({ dailyRate: Number(e.target.value) })}
            />
          </div>

          {/* Status */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
            <select
              className={inputCls}
              value={form.status}
              onChange={(e) => patch({ status: e.target.value as D.Bed['status'] })}
            >
              <option>Available</option>
              <option>Occupied</option>
              <option>Maintenance</option>
            </select>
          </div>

          {/* Patient — only shown when Occupied */}
          {form.status === 'Occupied' && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Booked Patient
              </label>
              <select
                className={inputCls}
                value={form.patientId}
                onChange={(e) => patch({ patientId: e.target.value })}
              >
                <option value="">— Select patient —</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.code ? ` · ${p.code}` : ''}
                  </option>
                ))}
              </select>
              {patients.length === 0 && (
                <p className="mt-1 text-xs text-gray-400">
                  No patients found. Register patients first.
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              className={inputCls}
              placeholder="Optional notes"
              value={form.notes}
              onChange={(e) => patch({ notes: e.target.value })}
            />
          </div>
        </div>

        <button
          onClick={() => {
            if (!form.bedNumber.trim() || !form.wardId) return;
            onSave(form);
          }}
          className="mt-6 w-full rounded-md bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          {isEdit ? 'Save Changes' : 'Add Bed'}
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Bed card
───────────────────────────────────────────────────────────────────────────── */
function BedCard({
  bed,
  patientName,
  patientCode,
  onEdit,
  onDelete,
}: {
  bed: D.Bed;
  patientName?: string;
  patientCode?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={`rounded-lg border p-3 text-sm ${STATUS_CARD[bed.status]}`}>
      <div className="mb-1 font-semibold text-gray-800">{bed.bedNumber}</div>
      <Badge status={bed.status} />
      <div className="mt-1 text-gray-500">${bed.dailyRate}/day</div>
      {patientName && (
        <div className="mt-1">
          <div className="truncate text-xs font-medium text-orange-700" title={patientName}>
            👤 {patientName}
          </div>
          <div className="truncate text-[11px] text-orange-600/80">
            {patientCode ? `Code: ${patientCode}` : 'No patient code on file'}
          </div>
        </div>
      )}
      {bed.notes && (
        <div className="mt-1 truncate text-xs text-gray-400" title={bed.notes}>
          {bed.notes}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 rounded border border-blue-300 bg-white py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex-1 rounded border border-red-200 bg-white py-1 text-xs font-medium text-red-500 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Delete confirm
───────────────────────────────────────────────────────────────────────────── */
function ConfirmDelete({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-2 text-lg font-semibold text-gray-900">Delete Bed?</h2>
        <p className="mb-5 text-sm text-gray-500">This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────────────────── */
export default function BedManagementPage() {
  const beds    = useListStore(D.bedsStore);
  const wards   = useListStore(D.wardsStore);
  const { data: patientData } = useQuery({
    queryKey: ['patients-for-beds'],
    queryFn: () => patientsApi.getAll().then((r) => r.data?.data ?? r.data ?? []),
    staleTime: 30000,
  });
  const patients: { id: string; name: string; code: string }[] = (patientData ?? []).map(
    (p: any) => ({
      id: p._id ?? p.id,
      name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.name || 'Unknown',
      code: p.patientNumber ?? p.patientCode ?? p.mrn ?? p.registrationNumber ?? p.code ?? '',
    })
  );

  const [modal,     setModal]     = useState<(Partial<D.Bed> & Omit<D.Bed, 'id'>) | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [search,    setSearch]    = useState('');

  const filtered = beds.filter((b) =>
    b.bedNumber.toLowerCase().includes(search.toLowerCase()),
  );

  const total     = beds.length;
  const available = beds.filter((b) => b.status === 'Available').length;
  const occupied  = beds.filter((b) => b.status === 'Occupied').length;

  // Build a quick id→name map for patients
  const patientMap: Record<string, { id: string; name: string; code: string }> =
    Object.fromEntries(patients.map((p) => [p.id, p]));
  const patientOptions = patients;

  function handleSave(data: Partial<D.Bed> & Omit<D.Bed, 'id'>) {
    const { id, ...rest } = data as D.Bed;
    if (id) {
      D.bedsStore.update(id, rest);
    } else {
      D.bedsStore.add(rest);
    }
    setModal(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bed Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {total} total &bull; {available} available &bull; {occupied} occupied
          </p>
        </div>
        <button
          onClick={() => setModal({ ...EMPTY })}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          + Add Bed
        </button>
      </div>

      {/* Legend + Search */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-5 text-sm text-gray-600">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-emerald-400" /> Available
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-orange-400" /> Occupied
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-gray-300" /> Maintenance
          </span>
        </div>
        <input
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Search beds…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Wards */}
      {wards.length === 0 && (
        <p className="text-sm italic text-gray-400">
          No wards configured. Add wards in Settings → Wards first.
        </p>
      )}
      {wards.map((ward) => {
        const wardBeds = filtered.filter((b) => b.wardId === ward.id);
        if (wardBeds.length === 0 && search) return null;
        const wardAvailable = wardBeds.filter((b) => b.status === 'Available').length;
        return (
          <section key={ward.id} className="mb-10">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-800">{ward.name}</h2>
              <p className="text-xs text-gray-400">
                {wardBeds[0] ? `Floor ${wardBeds[0].floor} · ` : ''}
                {wardAvailable} / {wardBeds.length} available
              </p>
            </div>
            {wardBeds.length === 0 ? (
              <p className="text-sm italic text-gray-400">No beds in this ward yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {wardBeds.map((bed) => (
                  <BedCard
                    key={bed.id}
                    bed={bed}
                    patientName={bed.patientId ? patientMap[bed.patientId]?.name : undefined}
                    patientCode={bed.patientId ? patientMap[bed.patientId]?.code : undefined}
                    onEdit={() => setModal({ ...bed })}
                    onDelete={() => setConfirmId(bed.id)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      {/* Orphan beds */}
      {(() => {
        const orphans = filtered.filter((b) => !wards.find((w) => w.id === b.wardId));
        if (!orphans.length) return null;
        return (
          <section className="mb-10">
            <h2 className="mb-3 text-base font-semibold text-gray-700">Unassigned Ward</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {orphans.map((bed) => (
                <BedCard
                  key={bed.id}
                  bed={bed}
                  patientName={bed.patientId ? patientMap[bed.patientId]?.name : undefined}
                    patientCode={bed.patientId ? patientMap[bed.patientId]?.code : undefined}
                  onEdit={() => setModal({ ...bed })}
                  onDelete={() => setConfirmId(bed.id)}
                />
              ))}
            </div>
          </section>
        );
      })()}

      {/* Modals */}
      {modal && (
        <BedModal
          wards={wards}
          patients={patientOptions}
          initial={modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
      {confirmId && (
        <ConfirmDelete
          onConfirm={() => { D.bedsStore.remove(confirmId); setConfirmId(null); }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}
