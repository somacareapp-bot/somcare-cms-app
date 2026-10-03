#!/bin/bash
#
# deploy_bedrent_occupied.sh
# ─────────────────────────────────────────────────────────────────────────────
# Rewrites frontend/src/modules/billing/BedRentPage.tsx so the page shows a
# "Currently occupied" table built from the live beds store — including beds
# that were marked Occupied in Bed Management rather than booked here.
# Only this one file changes. A backup is written first.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "📁 Working directory: $(pwd)"

if [ ! -f "frontend/src/modules/billing/BedRentPage.tsx" ]; then
  echo "❌ Run this from the project root (the folder containing 'frontend/')."
  exit 1
fi

TS=$(date +%Y%m%d_%H%M%S)
mkdir -p frontend/src/modules/billing/.backups
cp frontend/src/modules/billing/BedRentPage.tsx \
   "frontend/src/modules/billing/.backups/BedRentPage.tsx.$TS.bak"
echo "✅ Backup → frontend/src/modules/billing/.backups/BedRentPage.tsx.$TS.bak"

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
  patientId: string;
  dailyRate: number;
  admittedOn: string;            // yyyy-mm-dd
  dischargedOn?: string;         // yyyy-mm-dd
  bedNumber: string;             // snapshot, for discharged history
  wardName: string;
  patientName: string;
  patientCode: string;
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

  const wardName = (wardId: string) =>
    wards.find((w) => w.id === wardId)?.name ?? 'Unassigned ward';
  const findPatient = (id?: string) => (id ? patients.find((p) => p.id === id) : undefined);

  const [stays, setStays] = useState<Stay[]>([]);
  const [bedId, setBedId] = useState('');
  const [patientId, setPatientId] = useState('');
  const [admittedOn, setAdmittedOn] = useState(todayStr());
  const [error, setError] = useState('');

  const availableBeds = beds.filter((b) => b.status === 'Available');
  const occupiedBeds = beds.filter((b) => b.status === 'Occupied');

  /* Every occupied bed, with its billing record if one exists here. */
  const occupiedRows = occupiedBeds.map((bed) => {
    const stay = stays.find((s) => s.bedId === bed.id && !s.dischargedOn);
    const patient = findPatient(bed.patientId);
    return {
      bed,
      stay,
      patientName: patient?.name ?? (bed.patientId ? 'Unknown patient' : 'No patient assigned'),
      patientCode: patient?.code ?? '',
    };
  });

  const dischargedStays = stays.filter((s) => s.dischargedOn);

  const accrued = occupiedRows.reduce(
    (sum, r) =>
      r.stay ? sum + r.stay.dailyRate * nightsBetween(r.stay.admittedOn, todayStr()) : sum,
    0,
  );
  const untracked = occupiedRows.filter((r) => !r.stay).length;

  /* ─── Actions ─────────────────────────────────────────────────────────── */

  function makeStay(bed: D.Bed, patient: PatientOption, from: string): Stay {
    return {
      id: `${bed.id}-${Date.now()}`,
      bedId: bed.id,
      patientId: patient.id,
      dailyRate: bed.dailyRate ?? 0,
      admittedOn: from,
      bedNumber: bed.bedNumber,
      wardName: wardName(bed.wardId),
      patientName: patient.name,
      patientCode: patient.code,
    };
  }

  function bookBed() {
    setError('');
    const bed = beds.find((b) => b.id === bedId);
    const patient = patients.find((p) => p.id === patientId);

    if (!bed) return setError('Pick a bed to book.');
    if (!patient) return setError('Pick a patient for this bed.');
    if (bed.status !== 'Available') {
      return setError(`Bed ${bed.bedNumber} is no longer available — refresh the list.`);
    }

    D.bedsStore.update(bed.id, { status: 'Occupied', patientId: patient.id });
    setStays((prev) => [makeStay(bed, patient, admittedOn), ...prev]);

    setBedId('');
    setPatientId('');
    setAdmittedOn(todayStr());
  }

  /* Start billing a bed that was occupied from Bed Management. */
  function startBilling(bed: D.Bed) {
    const patient = findPatient(bed.patientId);
    if (!patient) {
      setError(
        `Bed ${bed.bedNumber} has no patient attached. Assign one in Bed Management first.`,
      );
      return;
    }
    setError('');
    setStays((prev) => [makeStay(bed, patient, todayStr()), ...prev]);
  }

  function freeBed(bed: D.Bed, stay?: Stay) {
    D.bedsStore.update(bed.id, { status: 'Available', patientId: '' });
    if (stay) {
      setStays((prev) =>
        prev.map((s) => (s.id === stay.id ? { ...s, dischargedOn: todayStr() } : s)),
      );
    }
  }

  /* ─── Render ──────────────────────────────────────────────────────────── */

  const inputCls =
    'w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
  const thCls = 'px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500';

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
          {
            label: 'Stays being billed',
            value: `${occupiedRows.length - untracked} of ${occupiedRows.length}`,
          },
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
          <div>
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
                No beds are available. Free one up below or in Bed Management.
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

      {/* Currently occupied — live from the beds store */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-semibold text-gray-900">Currently occupied</h2>
          <span className="text-xs text-gray-500">
            {occupiedRows.length} {occupiedRows.length === 1 ? 'bed' : 'beds'}
          </span>
        </div>

        {occupiedRows.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400">
            Every bed is free. Book one above to start a charge.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thCls}>Patient</th>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Bed</th>
                  <th className={thCls}>Ward</th>
                  <th className={thCls}>Admitted</th>
                  <th className={thCls}>Nights</th>
                  <th className={thCls}>Rate</th>
                  <th className={thCls}>Accrued</th>
                  <th className={thCls} />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {occupiedRows.map(({ bed, stay, patientName, patientCode }) => {
                  const nights = stay ? nightsBetween(stay.admittedOn, todayStr()) : 0;
                  return (
                    <tr key={bed.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{patientName}</td>
                      <td className="px-5 py-3 text-gray-500">{patientCode || '—'}</td>
                      <td className="px-5 py-3">{bed.bedNumber}</td>
                      <td className="px-5 py-3 text-gray-500">{wardName(bed.wardId)}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {stay ? stay.admittedOn : <span className="text-gray-400">Not billed</span>}
                      </td>
                      <td className="px-5 py-3">{stay ? nights : '—'}</td>
                      <td className="px-5 py-3">${money(bed.dailyRate ?? 0)}</td>
                      <td className="px-5 py-3 font-semibold">
                        {stay ? `$${money(stay.dailyRate * nights)}` : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          {!stay && (
                            <button
                              onClick={() => startBilling(bed)}
                              className="rounded border border-blue-300 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                            >
                              Start billing
                            </button>
                          )}
                          <button
                            onClick={() => freeBed(bed, stay)}
                            className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Discharge &amp; free bed
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {untracked > 0 && (
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            {untracked} occupied {untracked === 1 ? 'bed was' : 'beds were'} marked in Bed
            Management, so there is no admission date to bill from. Use “Start billing” to begin
            charging from today.
          </p>
        )}
      </div>

      {/* Discharged history */}
      {dischargedStays.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Discharged</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className={thCls}>Patient</th>
                  <th className={thCls}>Code</th>
                  <th className={thCls}>Bed</th>
                  <th className={thCls}>Ward</th>
                  <th className={thCls}>Stay</th>
                  <th className={thCls}>Nights</th>
                  <th className={thCls}>Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dischargedStays.map((s) => {
                  const nights = nightsBetween(s.admittedOn, s.dischargedOn as string);
                  return (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">{s.patientName}</td>
                      <td className="px-5 py-3 text-gray-500">{s.patientCode || '—'}</td>
                      <td className="px-5 py-3">{s.bedNumber}</td>
                      <td className="px-5 py-3 text-gray-500">{s.wardName}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {s.admittedOn} → {s.dischargedOn}
                      </td>
                      <td className="px-5 py-3">{nights}</td>
                      <td className="px-5 py-3 font-semibold">${money(s.dailyRate * nights)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400">
        Bed status and patient assignment are saved to the shared beds store, so Bed Management
        reflects them immediately. Admission dates and totals are held in this page only and clear
        on refresh — they will persist once a bed-charges endpoint exists on the backend.
      </p>
    </div>
  );
}
TSXEOF

echo "✅ BedRentPage.tsx rewritten with the live occupied-beds table"
echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
ls -l frontend/src/modules/billing/BedRentPage.tsx
grep -n "Currently occupied\|startBilling" frontend/src/modules/billing/BedRentPage.tsx | head
echo ""
echo "🎉 Done. Preview with:  cd frontend && npm run dev"
