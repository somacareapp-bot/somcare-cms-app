import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, X, Eye, EyeOff, KeyRound, Copy } from 'lucide-react';
import { usersApi, departmentsApi } from '../../services/api';
import { StaffProfileModal } from './StaffProfileModal';
import { useAuthStore } from '../../stores/auth.store';

interface StaffMember {
  id: string;
  username?: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  position: string | null;
  shift: string | null;
  salary: number | null;
  status: string;
  department: { id: string; name: string } | null;
  roles: { id: string; name: string }[];
}

const FILTER_STORAGE_KEY = 'somcare.staff.filters';
function loadSavedFilters(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function useStaff() {
  return useQuery<StaffMember[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await usersApi.getAll();
      return res.data ?? [];
    },
    placeholderData: [],
  });
}

function useRoles() {
  return useQuery({
    queryKey: ['roles'],
    queryFn: async () => (await usersApi.getRoles()).data ?? [],
    // Re-read roles from the server so a role created in Settings shows up here without a full refresh.
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    placeholderData: [],
  });
}

function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => (await departmentsApi.getAll()).data ?? [],
    placeholderData: [],
  });
}

// Show the role's display name ("Chief Nursing Officer"); fall back to a prettified raw name.
function roleLabel(r: { name: string; displayName?: string | null }) {
  if (r.displayName && r.displayName.trim()) return r.displayName.trim();
  return r.name
    .split(/[_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function initials(first: string, last: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase();
}

function maskPhone(phone: string | null) {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  return `${digits.slice(0, 2)}${'•'.repeat(Math.max(0, digits.length - 4))}${digits.slice(-2)}`;
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

function StaffModal({
  initial,
  departments,
  roles,
  onClose,
  onSubmit,
  isPending,
  error,
  canSetPassword,
}: {
  initial?: StaffMember | null;
  canSetPassword?: boolean;
  departments: any[];
  roles: any[];
  onClose: () => void;
  onSubmit: (data: any) => void;
  isPending: boolean;
  error?: string | null;
}) {
  const [firstName, setFirstName] = useState(initial?.firstName ?? '');
  const [lastName, setLastName] = useState(initial?.lastName ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [position, setPosition] = useState(initial?.position ?? '');
  const [shift, setShift] = useState(initial?.shift ?? 'Morning');
  const [salary, setSalary] = useState<number | null>(initial ? initial.salary : 0);
  const [departmentId, setDepartmentId] = useState(initial?.department?.id ?? '');
  const [roleIds, setRoleIds] = useState<string[]>(initial?.roles?.map((r) => r.id) ?? []);

  const toggleRole = (id: string) => {
    setRoleIds((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-sm font-semibold text-gray-800">
            {initial ? 'Edit Staff' : 'Add Staff'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {!initial && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Username</label>
                <input
                  value={username}
                  name="new-staff-username"
                  autoComplete="off"
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Password</label>
                <input
                  type="password"
                  value={password}
                  name="new-staff-password"
                  autoComplete="new-password"
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          )}

          {initial && canSetPassword && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">New password (optional)</label>
              <input
                type="text"
                value={password}
                name="staff-new-password"
                autoComplete="off"
                onChange={(e) => setPassword(e.target.value)}
                placeholder="e.g. Deyr2026 (empty = keep current, min 6 characters)"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-gray-400">They must change it at next login.</p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Phone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Position</label>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="e.g. Receptionist"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">None</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Roles</label>
            <div className="flex flex-wrap gap-2">
              {roles
                .filter((r: any) => r.isActive !== false || roleIds.includes(r.id))
                .map((r: any) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggleRole(r.id)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors ${
                    roleIds.includes(r.id)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {roleLabel(r)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="Morning">Morning</option>
                <option value="Evening">Evening</option>
                <option value="Night">Night</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Salary</label>
              <input
                type="number"
                min={0}
                value={salary ?? ''}
                onChange={(e) => setSalary(e.target.value === '' ? null : Number(e.target.value))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t px-5 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                firstName,
                lastName,
                username,
                password,
                phone,
                position,
                shift,
                salary,
                departmentId: departmentId || null,
                roleIds,
              })
            }
            disabled={!firstName.trim() || !lastName.trim() || (!initial && (!username.trim() || !password.trim())) || isPending}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? 'Saving...' : initial ? 'Save Changes' : 'Add Staff'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StaffDirectoryPage() {
  const queryClient = useQueryClient();
  const { data: staff = [] } = useStaff();
  const { data: departments = [] } = useDepartments();
  const { data: roles = [] } = useRoles();
  const authUser: any = useAuthStore((s: any) => s.user);
  const isAdmin = ((authUser?.roles ?? []) as any[]).some(
    (r: any) => (typeof r === 'string' ? r : r?.name) === 'administrator',
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [profileMember, setProfileMember] = useState<StaffMember | null>(null);

  // ---- filters (client-side) ----
  const [saved] = useState(loadSavedFilters);
  const [search, setSearch] = useState<string>(saved.search ?? '');
  const [deptFilter, setDeptFilter] = useState<string>(saved.dept ?? '');
  const [positionFilter, setPositionFilter] = useState<string>(saved.position ?? '');
  const [roleFilter, setRoleFilter] = useState<string>(saved.role ?? '');
  const [statusFilter, setStatusFilter] = useState<string>(saved.status ?? '');

  // A "Password requests" notification links here as /staff?q=<username> — jump
  // straight to that person when the page loads with that param.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) setSearch(q);
  }, [searchParams]);

  const positionOptions = useMemo(
    () =>
      Array.from(new Set(staff.map((s) => (s.position ?? '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [staff],
  );

  const filteredStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((m) => {
      if (q) {
        const haystack = [m.firstName, m.lastName, (m as any).username, m.position, m.department?.name, m.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (deptFilter && m.department?.id !== deptFilter) return false;
      if (positionFilter && (m.position ?? '').trim() !== positionFilter) return false;
      if (roleFilter && !(m.roles ?? []).some((r) => r.id === roleFilter)) return false;
      if (statusFilter && m.status !== statusFilter) return false;
      return true;
    });
  }, [staff, search, deptFilter, positionFilter, roleFilter, statusFilter]);

  // Remember the last filters (survives edits, page changes and refreshes).
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTER_STORAGE_KEY,
        JSON.stringify({ search, dept: deptFilter, position: positionFilter, role: roleFilter, status: statusFilter }),
      );
    } catch {
      /* storage unavailable - ignore */
    }
  }, [search, deptFilter, positionFilter, roleFilter, statusFilter]);

  // Drop a remembered filter whose department / role / position no longer exists.
  useEffect(() => {
    if (departments.length && deptFilter && !departments.some((d: any) => d.id === deptFilter)) setDeptFilter('');
  }, [departments, deptFilter]);
  useEffect(() => {
    if (roles.length && roleFilter && !roles.some((r: any) => r.id === roleFilter)) setRoleFilter('');
  }, [roles, roleFilter]);
  useEffect(() => {
    if (staff.length && positionFilter && !positionOptions.includes(positionFilter)) setPositionFilter('');
  }, [staff, positionOptions, positionFilter]);

  const hasFilters = Boolean(search || deptFilter || positionFilter || roleFilter || statusFilter);
  const clearFilters = () => {
    setSearch('');
    setDeptFilter('');
    setPositionFilter('');
    setRoleFilter('');
    setStatusFilter('');
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['staff'] });

  // Pick up any role added/changed in Settings each time the Add/Edit form opens.
  useEffect(() => {
    if (modalOpen) queryClient.invalidateQueries({ queryKey: ['roles'] });
  }, [modalOpen, queryClient]);

  const createMutation = useMutation({
    mutationFn: (data: any) => usersApi.create(data),
    onSuccess: (res: any, vars: any) => {
      invalidate();
      setModalOpen(false);
      setFormError(null);
      if (isAdmin && res?.data?.id && vars?.password) {
        setTempPasswords((prev) => ({ ...prev, [res.data.id]: String(vars.password) }));
      }
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message ?? 'Failed to add staff member.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: (_res, vars) => {
      // Show the saved change right away and un-mask that row's salary/phone;
      // the refetch below then confirms it from the server.
      const d = vars.data ?? {};
      queryClient.setQueryData<StaffMember[]>(['staff'], (old = []) =>
        old.map((m) =>
          m.id !== vars.id
            ? m
            : {
                ...m,
                firstName: d.firstName ?? m.firstName,
                lastName: d.lastName ?? m.lastName,
                phone: d.phone ?? m.phone,
                position: d.position ?? m.position,
                shift: d.shift ?? m.shift,
                salary: d.salary === undefined ? m.salary : d.salary,
                department: d.departmentId
                  ? ((departments as any[]).find((x) => x.id === d.departmentId) ?? m.department)
                  : null,
                roles: Array.isArray(d.roleIds)
                  ? (roles as any[]).filter((r) => d.roleIds.includes(r.id))
                  : m.roles,
              },
        ),
      );
      setRevealed((prev) => new Set(prev).add(vars.id));
      invalidate();
      setModalOpen(false);
      setEditing(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(err?.response?.data?.message ?? 'Failed to save changes.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => usersApi.remove(id),
    onSuccess: invalidate,
  });

  const resetMutation = useMutation({
    mutationFn: (id: string) => usersApi.resetPassword(id),
    onSuccess: (res) => setResetResult(res.data),
  });

  // Admin "eye": generate a temporary password and show it inline in the row.
  const [tempPasswords, setTempPasswords] = useState<Record<string, string>>({});
  const showPasswordMutation = useMutation({
    mutationFn: (id: string) => usersApi.resetPassword(id),
    onSuccess: (res, id) =>
      setTempPasswords((prev) => ({ ...prev, [id]: res.data?.tempPassword ?? '' })),
  });

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="p-8">
      <p className="text-sm text-slate-400 mb-2">Staff</p>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Directory</h1>
          <p className="text-sm text-slate-500 mt-1">{hasFilters ? 'Showing ' + filteredStaff.length + ' of ' + staff.length + ' staff members' : staff.length + ' staff members'}</p>
        </div>

        <button
          onClick={() => { setEditing(null); setFormError(null); setModalOpen(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          Add Staff
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, username, position, phone..."
          autoComplete="off"
          className="w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
        />
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
          <option value="">All departments</option>
          {departments.map((d: any) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
          <option value="">All positions</option>
          {positionOptions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
          <option value="">All roles</option>
          {roles.map((r: any) => (
            <option key={r.id} value={r.id}>{roleLabel(r)}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="text-sm font-medium text-blue-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-x-auto">
        {filteredStaff.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-400">{hasFilters ? 'No staff match the current filters' : 'No staff members yet'}</div>
        ) : (
          <table className="w-full min-w-max text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="pl-6 pr-2 py-3.5 w-12 text-[11px] font-semibold uppercase tracking-wider text-slate-400">#</th>
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Employee</th>
                {isAdmin && <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Username</th>}
                {isAdmin && <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Password</th>}
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Position</th>
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Department</th>
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Shift</th>
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Phone</th>
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Salary</th>
                <th className="px-4 py-3.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">Status</th>
                <th className="px-4 py-3.5 w-36" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStaff.map((member, i) => {
                const isRevealed = revealed.has(member.id);
                const shiftKey = (member.shift ?? '').toLowerCase();
                const shiftStyle = shiftKey.includes('morn')
                  ? 'bg-amber-50 text-amber-700 ring-amber-200'
                  : shiftKey.includes('even')
                  ? 'bg-orange-50 text-orange-700 ring-orange-200'
                  : shiftKey.includes('night')
                  ? 'bg-indigo-50 text-indigo-700 ring-indigo-200'
                  : 'bg-slate-50 text-slate-600 ring-slate-200';
                const roleText = (member.roles ?? []).map((r) => roleLabel(r)).join(' · ');
                return (
                  <tr
                    key={member.id}
                    onClick={() => setProfileMember(member)}
                    className="cursor-pointer transition-colors hover:bg-blue-50/40"
                  >
                    <td className="pl-6 pr-2 py-3.5 text-sm tabular-nums text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#0F2A5C] to-blue-600 text-xs font-bold text-white shadow-sm">
                          {initials(member.firstName, member.lastName)}
                        </div>
                        <div className="leading-tight">
                          <p className="text-sm font-semibold text-slate-900">
                            {member.firstName} {member.lastName}
                          </p>
                          {roleText && <p className="mt-0.5 text-xs text-slate-400">{roleText}</p>}
                        </div>
                      </div>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs text-slate-700">
                          {member.username ?? '—'}
                        </span>
                      </td>
                    )}
                    {isAdmin && (
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {tempPasswords[member.id] ? (
                            <>
                              <span className="select-all rounded-md bg-amber-50 px-2 py-1 font-mono text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
                                {tempPasswords[member.id]}
                              </span>
                              <button
                                onClick={() => navigator.clipboard?.writeText(tempPasswords[member.id])}
                                className="text-slate-300 transition-colors hover:text-slate-500"
                                title="Copy"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  setTempPasswords((prev) => {
                                    const next = { ...prev };
                                    delete next[member.id];
                                    return next;
                                  })
                                }
                                className="text-slate-300 transition-colors hover:text-slate-500"
                                title="Hide"
                              >
                                <EyeOff size={14} />
                              </button>
                            </>
                          ) : (
                            <>
                              <span className="text-sm tracking-widest text-slate-300">••••••••</span>
                              <button
                                onClick={() => {
                                  if (window.confirm(`Show a password for ${member.firstName}?\n\nThis generates a NEW temporary password and replaces their current one. They must change it at next login.`)) {
                                    showPasswordMutation.mutate(member.id);
                                  }
                                }}
                                disabled={showPasswordMutation.isPending}
                                className="text-slate-300 transition-colors hover:text-slate-500 disabled:opacity-50"
                                title="Show password (generates a new temporary one)"
                              >
                                <Eye size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-sm capitalize text-slate-700 whitespace-nowrap">{member.position ?? '—'}</td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {member.department?.name ? (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-100">
                          {member.department.name}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {member.shift ? (
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${shiftStyle}`}>
                          {member.shift}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                      {isRevealed ? (member.phone || '—') : maskPhone(member.phone)}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <span className="tabular-nums">
                          {member.salary == null
                            ? '—'
                            : isRevealed
                            ? `$${Number(member.salary).toLocaleString()}`
                            : '$•••••'}
                        </span>
                        <button
                          onClick={() => toggleReveal(member.id)}
                          className="text-slate-300 transition-colors hover:text-slate-500"
                          title={isRevealed ? 'Hide' : 'Reveal'}
                        >
                          {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <StatusBadge status={member.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setEditing(member); setFormError(null); setModalOpen(true); }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                          aria-label={`Edit ${member.firstName}`}
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => resetMutation.mutate(member.id)}
                          disabled={resetMutation.isPending}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                          aria-label={`Reset password for ${member.firstName}`}
                          title="Reset Password"
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(member.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                          aria-label={`Delete ${member.firstName}`}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <StaffModal
          initial={editing}
          canSetPassword={isAdmin}
          departments={departments}
          roles={roles}
          isPending={createMutation.isPending || updateMutation.isPending}
          error={formError}
          onClose={() => { setModalOpen(false); setEditing(null); setFormError(null); }}
          onSubmit={(raw) => {
            const data = { ...raw, salary: raw.salary === null || raw.salary === '' || raw.salary === undefined ? null : Number(raw.salary) };
            if (editing) {
              // Never overwrite username/password on edit — those fields
              // aren't shown in the edit form, so don't send blanks for them.
              const { username, password, ...rest } = data; // username is never changed on edit
              const newPw = isAdmin ? String(password ?? '').trim() : '';
              if (newPw && newPw.length < 6) {
                setFormError('Password must be at least 6 characters.');
                return;
              }
              const editId = editing.id;
              updateMutation.mutate(
                { id: editId, data: rest },
                {
                  onSuccess: async () => {
                    if (!newPw) return;
                    try {
                      await usersApi.resetPassword(editId, newPw);
                      setTempPasswords((prev) => ({ ...prev, [editId]: newPw }));
                    } catch (err: any) {
                      window.alert('Changes saved, but the password could not be set: ' + (err?.response?.data?.message ?? 'unknown error'));
                    }
                  },
                },
              );
            } else {
              createMutation.mutate(data);
            }
          }}
        />
      )}

      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setResetResult(null)}>
          <div className="w-full max-w-sm rounded-xl bg-white shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Password Reset</h3>
            <p className="text-xs text-slate-500 mb-4">
              Share this temporary password with <span className="font-medium">{resetResult.username}</span>. They'll be asked to change it on next login.
            </p>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 mb-4">
              <code className="text-sm font-mono text-slate-800">{resetResult.tempPassword}</code>
              <button
                onClick={() => navigator.clipboard.writeText(resetResult.tempPassword)}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setResetResult(null)}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        </div>
      )}
      {profileMember && (
        <StaffProfileModal
          member={profileMember}
          onClose={() => setProfileMember(null)}
        />
      )}
    </div>
  );
}

export default StaffDirectoryPage;
