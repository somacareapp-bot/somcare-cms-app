#!/bin/bash
#
# deploy_bedrent_live.sh
# ─────────────────────────────────────────────────────────────────────────────
# 1. Rewrites frontend/src/modules/billing/BedRentPage.tsx so it reads the LIVE
#    bed list from D.bedsStore (same source Bed Management uses), only offers
#    Available beds, and flips the bed to Occupied + assigns the patient on book.
# 2. Patches frontend/src/modules/beds/BedManagementPage.tsx so occupied bed
#    cards show the patient NAME and PATIENT CODE.
#
# Backups are written to a .backups folder next to each file.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "📁 Working directory: $(pwd)"

if [ ! -d "frontend/src/modules/billing" ] || [ ! -f "frontend/src/modules/beds/BedManagementPage.tsx" ]; then
  echo "❌ Run this from the project root (the folder containing 'frontend/')."
  exit 1
fi

TS=$(date +%Y%m%d_%H%M%S)

# ─── 1. Bed Rent page ────────────────────────────────────────────────────────
mkdir -p frontend/src/modules/billing/.backups
if [ -f frontend/src/modules/billing/BedRentPage.tsx ]; then
  cp frontend/src/modules/billing/BedRentPage.tsx \
     "frontend/src/modules/billing/.backups/BedRentPage.tsx.$TS.bak"
  echo "✅ Backup → frontend/src/modules/billing/.backups/BedRentPage.tsx.$TS.bak"
fi

cat > frontend/src/modules/billing/BedRentPage.tsx << 'TSXEOF'
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useListStore } from '../../stores/store';
import { patientsApi } from '../../services/api';
import * as D from '../../stores/settingsData';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Stay {
  id: string;
  bedId: string;
  bedNumber: string;
  wardName: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  dailyRate: number;
  admittedOn: string;            // yyyy-mm-dd
  dischargedOn?: string;         // yyyy-mm-dd
}

interface PatientOption {
  id: string;
  name: string;
  code: string;
}

/* ─── Helpers ───────────────────────────────────────────────────────────── */

const todayStr = () => new Date().toISOString().slice(0, 10);

function nightsBetween(from: string, to: string) {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  if (Number.isNaN(ms)) return 1;
  return Math.max(1, Math.ceil(ms / 86_400_000));
}

const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ─── Page ──────────────────────────────────────────────────────────────── */

export function BedRentPage() {
  const beds = useListStore(D.bedsStore);
  const wards = useListStore(D.wardsStore);

  const { data: patientData, isLoading: patientsLoading } = useQuery({
    queryKey: ['patients-for-bed-rent'],
    queryFn: () => patientsApi.getAll().then((r: any) => r.data?.data ?? r.data ?? []),
    staleTime: 30000,
  });

  const patients: PatientOption[] = useMemo(
    () =>
      (patientData ?? []).map((p: any) => ({
        id: p._id ?? p.id,
        name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.name || 'Unknown',
        code:
          p.patientNumber ??
          p.patientCode ??
          p.mrn ??
          p.registrationNumber ??
          p.code ??
          '',
      })),
    [patientData],
  );

  const wardName = (wardId: string) => wards.find((w) => w.id === wardId)?.name ?? 'Unassigned ward';

  const [stays, setStays] = useState<Stay[]>([]);
  const [bedId, setBedId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [admittedOn, setAdmittedOn] = useState(todayStr());
  const [error, setError] = useState('');

  const availableBeds = beds.filter((b) => b.status === 'Available');
  const occupiedBeds = beds.filter((b) => b.status === 'Occupied');

  const activeStays = stays.filter((s) => !s.dischargedOn);
  const accrued = activeStays.reduce(
    (sum, s) => sum + s.dailyRate * nightsBetween(s.admittedOn, todayStr()),
    0,
  );

  /* ─── Actions ─────────────────────────────────────────────────────────── */

  function bookBed() {
    setError('');
    const bed = beds.find((b) => b.id === bedId);
    const patient = patients.find((p) => p.id === patientId);

    if (!bed) return setError('Pick a bed to book.');
    if (!patient) return setError('Pick a patient for this bed.');
    if (bed.status !== 'Available') {
      return setError(`Bed ${bed.bedNumber} is no longer available — refresh the list.`);
    }

    // Live write to the same store Bed Management reads
    D.bedsStore.update(bed.id, { status: 'Occupied', patientId: patient.id });

    setStays((prev) => [
      {
        id: `${bed.id}-${Date.now()}`,
        bedId: bed.id,
        bedNumber: bed.bedNumber,
        wardName: wardName(bed.wardId),
        patientId: patient.id,
        patientName: patient.name,
        patientCode: patient.code,
        dailyRate: bed.dailyRate ?? 0,
        admittedOn,
      },
      ...prev,
    ]);

    setBedId('');
    setPatientId('');
    setAdmittedOn(todayStr());
  }

  function dischargeStay(stay: Stay) {
    const bed = beds.find((b) => b.id === stay.bedId);
    if (bed) {
      D.bedsStore.update(bed.id, { status: 'Available', patientId: '' });
    }
    setStays((prev) =>
      prev.map((s) => (s.id === stay.id ? { ...s, dischargedOn: todayStr() } : s)),
    );
  }

  /* ─── Render ──────────────────────────────────────────────────────────── */

  const inputCls =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bed rent</h1>
        <p className="mt-1 text-sm text-gray-500">
          Book a bed for a patient and track the daily charge. Booking here marks the bed
          occupied in Bed Management straight away.
        </p>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Beds available', value: String(availableBeds.length) },
          { label: 'Beds occupied', value: String(occupiedBeds.length) },
          { label: 'Active stays billed', value: String(activeStays.length) },
          { label: 'Accrued to date', value: `$${money(accrued)}` },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-medium text-gray-500">{k.label}</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">{k.value}</p>
          </div>
        ))}
      </div>

      {/* Book a bed */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Book a bed</h2>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Bed</label>
            <select className={inputCls} value={bedId} onChange={(e) => setBedId(e.target.value)}>
              <option value="">Select an available bed</option>
              {availableBeds.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.bedNumber} — {wardName(b.wardId)} (${b.dailyRate}/day)
                </option>
              ))}
            </select>
            {availableBeds.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                No beds are available. Free one up in Bed Management first.
              </p>
            )}
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700">Patient</label>
            <select
              className={inputCls}
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
            >
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.code ? ` · ${p.code}` : ''}
                </option>
              ))}
            </select>
            {!patientsLoading && patients.length === 0 && (
              <p className="mt-1 text-xs text-gray-400">
                No patients found. Register a patient first.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Admitted on</label>
            <input
              type="date"
              className={inputCls}
              value={admittedOn}
              onChange={(e) => setAdmittedOn(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <button
          onClick={bookBed}
          className="mt-4 rounded-md bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Book bed
        </button>
      </div>

      {/* Charges */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Bed charges</h2>
        </div>

        {stays.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            No bed charges yet. Book a bed above to start one.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3">Patient</th>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Bed</th>
                <th className="px-5 py-3">Ward</th>
                <th className="px-5 py-3">Admitted</th>
                <th className="px-5 py-3">Nights</th>
                <th className="px-5 py-3">Rate</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stays.map((s) => {
                const nights = nightsBetween(s.admittedOn, s.dischargedOn ?? todayStr());
                return (
                  <tr key={s.id}>
                    <td className="px-5 py-3 font-medium text-gray-900">{s.patientName}</td>
                    <td className="px-5 py-3 text-gray-500">{s.patientCode || '—'}</td>
                    <td className="px-5 py-3">{s.bedNumber}</td>
                    <td className="px-5 py-3 text-gray-500">{s.wardName}</td>
                    <td className="px-5 py-3 text-gray-500">{s.admittedOn}</td>
                    <td className="px-5 py-3">{nights}</td>
                    <td className="px-5 py-3">${money(s.dailyRate)}</td>
                    <td className="px-5 py-3 font-semibold">${money(s.dailyRate * nights)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                          s.dischargedOn
                            ? 'border-gray-200 bg-gray-100 text-gray-500'
                            : 'border-orange-200 bg-orange-100 text-orange-700'
                        }`}
                      >
                        {s.dischargedOn ? `Discharged ${s.dischargedOn}` : 'In bed'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {!s.dischargedOn && (
                        <button
                          onClick={() => dischargeStay(s)}
                          className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Discharge &amp; free bed
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-gray-400">
        Bed status changes are saved to the shared beds store, so Bed Management reflects them
        immediately. The charge rows above are held in this page only and clear on refresh —
        they will persist once a bed-charges endpoint exists on the backend.
      </p>
    </div>
  );
}
TSXEOF
echo "✅ BedRentPage.tsx rewritten (live beds store)"

# ─── 2. Bed Management page ──────────────────────────────────────────────────
cat > /tmp/patch_bedmanagement_patient_code.py << 'PYEOF'
import os, shutil, datetime, sys

path = "frontend/src/modules/beds/BedManagementPage.tsx"
with open(path) as f:
    content = f.read()

def rep(old, new, expected=1):
    global content
    n = content.count(old)
    if n != expected:
        print("ERROR: expected %d match(es), found %d for anchor:\n%s" % (expected, n, old[:90]))
        sys.exit(1)
    content = content.replace(old, new)

# a) widen the patients list to carry a code
rep(
"""  patients: { id: string; name: string }[];""",
"""  patients: { id: string; name: string; code: string }[];""")

rep(
"""  const patients: { id: string; name: string }[] = (patientData ?? []).map(
    (p: any) => ({ id: p._id ?? p.id, name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.name || 'Unknown' })
  );""",
"""  const patients: { id: string; name: string; code: string }[] = (patientData ?? []).map(
    (p: any) => ({
      id: p._id ?? p.id,
      name: `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim() || p.name || 'Unknown',
      code: p.patientNumber ?? p.patientCode ?? p.mrn ?? p.registrationNumber ?? p.code ?? '',
    })
  );""")

# b) map id -> full patient object instead of just the name
rep(
"""  const patientMap = Object.fromEntries(patients.map((p) => [p.id, p.name]));""",
"""  const patientMap: Record<string, { id: string; name: string; code: string }> =
    Object.fromEntries(patients.map((p) => [p.id, p]));""")

# c) BedCard accepts a patient code
rep(
"""function BedCard({
  bed,
  patientName,
  onEdit,
  onDelete,
}: {
  bed: D.Bed;
  patientName?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {""",
"""function BedCard({
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
}) {""")

# d) render name + code on the card
rep(
"""      {patientName && (
        <div className="mt-1 truncate text-xs font-medium text-orange-700" title={patientName}>
          \U0001F464 {patientName}
        </div>
      )}""",
"""      {patientName && (
        <div className="mt-1">
          <div className="truncate text-xs font-medium text-orange-700" title={patientName}>
            \U0001F464 {patientName}
          </div>
          <div className="truncate text-[11px] text-orange-600/80">
            {patientCode ? `Code: ${patientCode}` : 'No patient code on file'}
          </div>
        </div>
      )}""")

# e) both BedCard call sites
rep(
"""patientName={bed.patientId ? patientMap[bed.patientId] : undefined}""",
"""patientName={bed.patientId ? patientMap[bed.patientId]?.name : undefined}
                    patientCode={bed.patientId ? patientMap[bed.patientId]?.code : undefined}""",
expected=2)

# f) show the code in the modal's patient picker too
rep(
"""                  <option key={p.id} value={p.id}>{p.name}</option>""",
"""                  <option key={p.id} value={p.id}>
                    {p.name}{p.code ? ` \u00b7 ${p.code}` : ''}
                  </option>""")

backup_dir = "frontend/src/modules/beds/.backups"
os.makedirs(backup_dir, exist_ok=True)
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy(path, backup_dir + "/BedManagementPage.tsx." + ts + ".bak")

with open(path, "w") as f:
    f.write(content)

print("SUCCESS: BedManagementPage.tsx now shows patient name + code on occupied beds.")
PYEOF

python3 /tmp/patch_bedmanagement_patient_code.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -l frontend/src/modules/billing/BedRentPage.tsx frontend/src/modules/beds/BedManagementPage.tsx
grep -n "patientCode" frontend/src/modules/beds/BedManagementPage.tsx | head -8
echo ""
echo "🎉 Done. Preview with:  cd frontend && npm run dev"
