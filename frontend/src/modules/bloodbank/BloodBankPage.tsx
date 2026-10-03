import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Droplet, UserPlus, Plus, ArrowUpRight, X } from 'lucide-react';
import { bloodBankApi } from '../../services/api';

const BLOOD_TYPES = ['A-', 'A+', 'AB-', 'AB+', 'B-', 'B+', 'O-', 'O+'] as const;
type BloodType = (typeof BLOOD_TYPES)[number];

const CRITICAL_THRESHOLD = 10;

interface InventoryRow {
  bloodType: BloodType;
  units: number;
}

interface Donor {
  id: string;
  name: string;
  bloodType: BloodType;
  units: number;
  date: string;
  contact?: string;
}

function useInventory() {
  return useQuery<InventoryRow[]>({
    queryKey: ['blood-bank', 'inventory'],
    queryFn: async () => {
      const res = await bloodBankApi.getInventory();
      return res.data ?? [];
    },
    // Backend endpoint may not exist yet — fall back to an empty board
    // for every blood type rather than crashing the page.
    placeholderData: BLOOD_TYPES.map((bt) => ({ bloodType: bt, units: 0 })),
    retry: 1,
  });
}

function useDonors() {
  return useQuery<Donor[]>({
    queryKey: ['blood-bank', 'donors'],
    queryFn: async () => {
      const res = await bloodBankApi.getDonors();
      return res.data ?? [];
    },
    placeholderData: [],
    retry: 1,
  });
}

function QuantityModal({
  title,
  bloodType,
  confirmLabel,
  onClose,
  onConfirm,
  extraField,
}: {
  title: string;
  bloodType: BloodType;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: (units: number, note: string) => void;
  extraField?: string;
}) {
  const [units, setUnits] = useState(1);
  const [note, setNote] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">
            {title} — <span className="text-red-600">{bloodType}</span>
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Units</label>
            <input
              type="number"
              min={1}
              value={units}
              onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              {extraField ?? 'Note (optional)'}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={extraField ? extraField : 'e.g. Emergency transfusion'}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(units, note)}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function DonationModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (d: any) => void }) {
  const [name, setName] = useState('');
  const [bloodType, setBloodType] = useState<BloodType>('O+');
  const [units, setUnits] = useState(1);
  const [contact, setContact] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">Record Donation</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Donor name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              placeholder="Full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Blood type</label>
              <select
                value={bloodType}
                onChange={(e) => setBloodType(e.target.value as BloodType)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              >
                {BLOOD_TYPES.map((bt) => (
                  <option key={bt} value={bt}>
                    {bt}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Units</label>
              <input
                type="number"
                min={1}
                value={units}
                onChange={(e) => setUnits(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Contact (optional)</label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
                placeholder="Phone or email"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Donation date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onConfirm({ name, bloodType, units, contact, donationDate: date })}
            disabled={!name.trim()}
            className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Save Donation
          </button>
        </div>
      </div>
    </div>
  );
}

export function BloodBankPage() {
  const queryClient = useQueryClient();
  const { data: inventory = [] } = useInventory();
  const { data: donors = [] } = useDonors();

  const [addModalType, setAddModalType] = useState<BloodType | null>(null);
  const [issueModalType, setIssueModalType] = useState<BloodType | null>(null);
  const [donationOpen, setDonationOpen] = useState(false);

  const byType = useMemo(() => {
    const map = new Map<BloodType, number>(BLOOD_TYPES.map((bt) => [bt, 0]));
    inventory.forEach((row) => map.set(row.bloodType, row.units));
    return map;
  }, [inventory]);

  const totalUnits = useMemo(
    () => Array.from(byType.values()).reduce((a, b) => a + b, 0),
    [byType]
  );
  const criticalCount = useMemo(
    () => Array.from(byType.values()).filter((u) => u < CRITICAL_THRESHOLD).length,
    [byType]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['blood-bank'] });
  };

  const addMutation = useMutation({
    mutationFn: (vars: { bloodType: BloodType; units: number; note: string }) =>
      bloodBankApi.addUnits(vars.bloodType, vars.units, vars.note),
    onSuccess: invalidate,
  });

  const issueMutation = useMutation({
    mutationFn: (vars: { bloodType: BloodType; units: number; note: string }) =>
      bloodBankApi.issueUnits(vars.bloodType, vars.units, vars.note),
    onSuccess: invalidate,
  });

  const donationMutation = useMutation({
    mutationFn: (data: any) => bloodBankApi.recordDonation(data),
    onSuccess: invalidate,
  });

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-600">
            <Droplet size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Blood Bank</h1>
            <p className="text-sm text-gray-500">
              {totalUnits} total units • {criticalCount} groups critical
            </p>
          </div>
        </div>
        <button
          onClick={() => setDonationOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          <UserPlus size={16} />
          Record Donation
        </button>
      </div>

      {/* Inventory */}
      <h2 className="mb-3 text-sm font-semibold text-gray-700">Inventory</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {BLOOD_TYPES.map((bt) => {
          const units = byType.get(bt) ?? 0;
          const isCritical = units < CRITICAL_THRESHOLD;
          return (
            <div key={bt} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1 text-base font-semibold text-gray-800">
                  <Droplet size={16} className="text-red-500" />
                  {bt}
                </span>
                {isCritical && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-600">
                    Critical
                  </span>
                )}
              </div>
              <div className="text-2xl font-bold text-gray-900">{units}</div>
              <div className="mb-3 text-xs text-gray-500">units available</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setAddModalType(bt)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-green-50 px-2 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100"
                >
                  <Plus size={12} />
                  Add
                </button>
                <button
                  onClick={() => setIssueModalType(bt)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-orange-50 px-2 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                >
                  <ArrowUpRight size={12} />
                  Issue
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recent donors */}
      <h2 className="mb-3 mt-8 text-sm font-semibold text-gray-700">Recent Donors</h2>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {donors.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            No donations recorded yet
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Donor</th>
                <th className="px-4 py-2 font-medium">Blood Type</th>
                <th className="px-4 py-2 font-medium">Units</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {donors.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2 font-medium text-gray-800">{d.name}</td>
                  <td className="px-4 py-2 text-red-600">{d.bloodType}</td>
                  <td className="px-4 py-2">{d.units}</td>
                  <td className="px-4 py-2 text-gray-500">{d.date}</td>
                  <td className="px-4 py-2 text-gray-500">{d.contact ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {addModalType && (
        <QuantityModal
          title="Add Units"
          bloodType={addModalType}
          confirmLabel="Add"
          onClose={() => setAddModalType(null)}
          onConfirm={(units, note) => {
            addMutation.mutate({ bloodType: addModalType, units, note });
            setAddModalType(null);
          }}
        />
      )}
      {issueModalType && (
        <QuantityModal
          title="Issue Units"
          bloodType={issueModalType}
          confirmLabel="Issue"
          extraField="Reason / patient (optional)"
          onClose={() => setIssueModalType(null)}
          onConfirm={(units, note) => {
            issueMutation.mutate({ bloodType: issueModalType, units, note });
            setIssueModalType(null);
          }}
        />
      )}
      {donationOpen && (
        <DonationModal
          onClose={() => setDonationOpen(false)}
          onConfirm={(data) => {
            donationMutation.mutate(data);
            setDonationOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default BloodBankPage;
