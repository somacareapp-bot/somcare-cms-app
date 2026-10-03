import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Plus, Pencil, Trash2, X } from 'lucide-react';
import { departmentsApi, usersApi } from '../../services/api';

interface Department {
  id: string;
  name: string;
  rooms: number | null;
  headDoctor: { id: string; fullName: string } | null;
  staffCount: number;
}

const ACCENTS = [
  { border: 'border-l-blue-500', bg: 'bg-blue-100', text: 'text-blue-600' },
  { border: 'border-l-green-500', bg: 'bg-green-100', text: 'text-green-600' },
  { border: 'border-l-orange-500', bg: 'bg-orange-100', text: 'text-orange-600' },
  { border: 'border-l-purple-500', bg: 'bg-purple-100', text: 'text-purple-600' },
  { border: 'border-l-pink-500', bg: 'bg-pink-100', text: 'text-pink-600' },
];

function useDepartments() {
  return useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await departmentsApi.getAll();
      return res.data ?? [];
    },
    placeholderData: [],
  });
}

function useDoctors() {
  return useQuery({
    queryKey: ['users', 'all-staff-for-dept-head'],
    queryFn: () =>
      usersApi.getAll().then((r) => (r.data ?? []).filter((u: any) => u.status === 'active')),
    placeholderData: [],
  });
}

function DepartmentModal({
  initial,
  doctors,
  onClose,
  onSubmit,
  isPending,
}: {
  initial?: Department | null;
  doctors: any[];
  onClose: () => void;
  onSubmit: (data: { name: string; rooms?: number; headDoctorId?: string | null }) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [rooms, setRooms] = useState(initial?.rooms ?? 0);
  const [headDoctorId, setHeadDoctorId] = useState(initial?.headDoctor?.id ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">
            {initial ? 'Edit Department' : 'Add Department'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Department name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Cardiology"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Head of Department</label>
            <select
              value={headDoctorId}
              onChange={(e) => setHeadDoctorId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">None</option>
              {doctors.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.firstName} {d.lastName}{d.position ? ` — ${d.position}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Rooms</label>
            <input
              type="number"
              min={0}
              value={rooms}
              onChange={(e) => setRooms(Math.max(0, Number(e.target.value)))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ name, rooms, headDoctorId: headDoctorId || null })}
            disabled={!name.trim() || isPending}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : initial ? 'Save Changes' : 'Add Department'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function DepartmentsPage() {
  const queryClient = useQueryClient();
  const { data: departments = [] } = useDepartments();
  const { data: doctors = [] } = useDoctors();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['departments'] });

  const createMutation = useMutation({
    mutationFn: (data: any) => departmentsApi.create(data),
    onSuccess: () => { invalidate(); setModalOpen(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => departmentsApi.update(id, data),
    onSuccess: () => { invalidate(); setModalOpen(false); setEditing(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => departmentsApi.remove(id),
    onSuccess: invalidate,
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Departments</h1>
          <p className="text-sm text-gray-500">{departments.length} departments</p>
        </div>
        <button
          onClick={() => { setEditing(null); setModalOpen(true); }}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Department
        </button>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400 shadow-sm">
          No departments yet
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {departments.map((d, i) => {
            const accent = ACCENTS[i % ACCENTS.length];
            return (
              <div
                key={d.id}
                className={`rounded-xl border border-l-4 ${accent.border} border-gray-200 bg-white p-4 shadow-sm`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${accent.bg}`}>
                      <Layers size={18} className={accent.text} />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">{d.name}</div>
                      {d.headDoctor && (
                        <div className="text-xs text-gray-500">Dr. {d.headDoctor.fullName}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditing(d); setModalOpen(true); }}
                      className="text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(d.id)}
                      className="text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-gray-500">
                  <span>{d.staffCount} staff</span>
                  {d.rooms != null && <span>{d.rooms} rooms</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <DepartmentModal
          initial={editing}
          doctors={doctors}
          isPending={createMutation.isPending || updateMutation.isPending}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSubmit={(data) =>
            editing
              ? updateMutation.mutate({ id: editing.id, data })
              : createMutation.mutate(data)
          }
        />
      )}
    </div>
  );
}

export default DepartmentsPage;
