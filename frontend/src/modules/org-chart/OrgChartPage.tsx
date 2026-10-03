import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../../stores/auth.store';
import { usersApi, departmentsApi } from '../../services/api';
import { orgChartApi, LinkType, OrgNode, OrgStatus } from './orgChartApi';

// ---------- types for the real staff data (same shape the Staff page uses)
interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  position: string | null;
  status: string;
  department: { id: string; name: string } | null;
  roles: { id: string; name: string }[];
}
interface Option {
  id: string;
  name: string;
}

// ---------- tree connector lines (plain CSS, Tailwind can't do these cleanly)
const CONNECTOR_CSS = `
.oc-children { display:flex; justify-content:center; position:relative; padding-top:24px; }
.oc-children::before { content:''; position:absolute; top:0; left:50%; height:24px; border-left:1px solid #cbd5e1; }
.oc-child { position:relative; padding:24px 8px 0 8px; display:flex; flex-direction:column; align-items:center; }
.oc-child::before, .oc-child::after { content:''; position:absolute; top:0; right:50%; width:50%; height:24px; border-top:1px solid #cbd5e1; }
.oc-child::after { right:auto; left:50%; border-left:1px solid #cbd5e1; }
.oc-child:only-child { padding-top:0; }
.oc-child:only-child::before, .oc-child:only-child::after { display:none; }
.oc-child:first-child::before, .oc-child:last-child::after { border:0 none; }
.oc-child:last-child::before { border-right:1px solid #cbd5e1; border-radius:0 6px 0 0; }
.oc-child:first-child::after { border-radius:6px 0 0 0; }
`;

const TIERS = [
  { card: 'bg-red-950 text-red-50', sub: 'text-red-200', badge: 'bg-black/30 text-red-50' },
  { card: 'bg-red-900 text-red-50', sub: 'text-red-200', badge: 'bg-black/30 text-red-50' },
  { card: 'bg-red-800 text-white', sub: 'text-red-100', badge: 'bg-black/25 text-white' },
  { card: 'bg-white text-red-900 border border-red-300', sub: 'text-red-700', badge: 'bg-red-50 text-red-800' },
  { card: 'bg-red-100 text-red-950', sub: 'text-red-800', badge: 'bg-red-200 text-red-900' },
];

// ---------- tree helpers
function findNode(nodes: OrgNode[], id: string | null): OrgNode | null {
  if (!id) return null;
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children ?? [], id);
    if (hit) return hit;
  }
  return null;
}

function descendantIds(node: OrgNode, out = new Set<string>()): Set<string> {
  (node.children ?? []).forEach((c) => {
    out.add(c.id);
    descendantIds(c, out);
  });
  return out;
}

function flatten(nodes: OrgNode[], depth = 0, out: { node: OrgNode; depth: number }[] = []) {
  nodes.forEach((n) => {
    out.push({ node: n, depth });
    flatten(n.children ?? [], depth + 1, out);
  });
  return out;
}

function filterTree(nodes: OrgNode[], q: string): OrgNode[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return nodes;
  return nodes.reduce<OrgNode[]>((acc, n) => {
    const hay = `${n.title} ${n.subtitle ?? ''} ${n.department ?? ''}`.toLowerCase();
    const kids = filterTree(n.children ?? [], q);
    if (hay.includes(needle) || kids.length) acc.push({ ...n, children: kids });
    return acc;
  }, []);
}

function sumHeadcount(nodes: OrgNode[]): number {
  return nodes.reduce((s, n) => s + (n.headcount || 0) + sumHeadcount(n.children ?? []), 0);
}

function errMsg(e: any, fallback: string) {
  const m = e?.response?.data?.message;
  return Array.isArray(m) ? m.join(', ') : m || fallback;
}

// ---------- staff <-> node linking
function matchesLink(u: StaffUser, type?: LinkType | null, value?: string | null): boolean {
  if (!type || !value) return false;
  if (type === 'role') return (u.roles ?? []).some((r) => r.id === value);
  if (type === 'department') return u.department?.id === value;
  if (type === 'position') return (u.position ?? '').trim().toLowerCase() === value.trim().toLowerCase();
  return false;
}

interface NodeInfo {
  ids: Set<string>; // distinct active staff in this box and everything below it
  linked: boolean; // this box or something below it is linked to staff data
}

// Counts are distinct people, so someone matching a box and its sub-box is counted once.
function computeInfo(nodes: OrgNode[], staff: StaffUser[]): Map<string, NodeInfo> {
  const out = new Map<string, NodeInfo>();
  const walk = (n: OrgNode): NodeInfo => {
    const ids = new Set<string>();
    let linked = false;
    if (n.linkType && n.linkValue) {
      linked = true;
      staff.forEach((u) => {
        if (u.status === 'active' && matchesLink(u, n.linkType, n.linkValue)) ids.add(u.id);
      });
    }
    (n.children ?? []).forEach((c) => {
      const ci = walk(c);
      if (ci.linked) linked = true;
      ci.ids.forEach((id) => ids.add(id));
    });
    const info = { ids, linked };
    out.set(n.id, info);
    return info;
  };
  nodes.forEach(walk);
  return out;
}

function displayCount(n: OrgNode, info?: NodeInfo): number {
  return info?.linked ? info.ids.size : n.headcount || 0;
}

function initials(u: StaffUser) {
  return `${u.firstName?.[0] ?? ''}${u.lastName?.[0] ?? ''}`.toUpperCase();
}

// ---------- tree rendering
interface BranchProps {
  node: OrgNode;
  depth: number;
  canEdit: boolean;
  selectedId: string | null;
  info: Map<string, NodeInfo>;
  onSelect: (id: string) => void;
  onAdd: (parentId: string) => void;
  totalStaff?: number;
}

function Branch({ node, depth, canEdit, selectedId, info, onSelect, onAdd, totalStaff }: BranchProps) {
  const tier = TIERS[Math.min(depth, TIERS.length - 1)];
  const inactive = node.status === 'inactive';
  const ni = info.get(node.id);
  const count = depth === 0 && totalStaff !== undefined ? totalStaff : displayCount(node, ni);
  const showBadge = ni?.linked || count > 0;
  return (
    <div className="flex flex-col items-center">
      <div
        onClick={() => onSelect(node.id)}
        className={`group relative min-w-[150px] max-w-[210px] cursor-pointer rounded-xl px-4 py-2.5 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tier.card} ${
          selectedId === node.id ? 'ring-2 ring-amber-400 ring-offset-2' : ''
        } ${inactive ? 'opacity-60' : ''}`}
      >
        <div className="text-[13px] font-medium leading-tight">{node.title}</div>
        {node.subtitle && <div className={`mt-0.5 text-[11px] leading-tight ${tier.sub}`}>{node.subtitle}</div>}
        {showBadge && (
          <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${tier.badge}`}>
            {count} staff
          </span>
        )}
        {canEdit && (
          <button
            title="Add child role"
            onClick={(e) => {
              e.stopPropagation();
              onAdd(node.id);
            }}
            className="absolute -bottom-2.5 left-1/2 z-10 hidden h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-red-300 bg-red-50 text-red-900 group-hover:flex"
          >
            <Plus size={12} />
          </button>
        )}
      </div>
      {node.children?.length > 0 && (
        <div className="oc-children">
          {node.children.map((c) => (
            <div key={c.id} className="oc-child">
              <Branch
                node={c}
                depth={depth + 1}
                canEdit={canEdit}
                selectedId={selectedId}
                info={info}
                onSelect={onSelect}
                onAdd={onAdd}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- form state
interface FormState {
  title: string;
  subtitle: string;
  department: string;
  location: string;
  headcount: number;
  status: OrgStatus;
  parentId: string; // '' = top level
  linkType: '' | LinkType;
  linkValue: string;
  linkedUserId: string;
}
type ModalState = { mode: 'add' | 'edit'; id?: string; form: FormState } | null;

const emptyForm = (parentId = ''): FormState => ({
  title: '',
  subtitle: '',
  department: '',
  location: '',
  headcount: 0,
  status: 'active',
  parentId,
  linkType: '',
  linkValue: '',
  linkedUserId: '',
});

const inputCls =
  'w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm focus:border-red-700 focus:outline-none focus:ring-1 focus:ring-red-700';

// ---------- page
export function OrgChartPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuthStore();
  const canCreate = hasPermission('orgchart:create');
  const canUpdate = hasPermission('orgchart:update');
  const canDelete = hasPermission('orgchart:delete');
  const canEdit = canCreate; // header 'Add role' and the '+' add-child button

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [formError, setFormError] = useState('');

  const { data: tree = [], isLoading, error } = useQuery({
    queryKey: ['org-chart'],
    queryFn: orgChartApi.tree,
    refetchInterval: 30000,
  });

  // Real staff data: same query keys as the Staff page, so the cache is shared
  const staffQ = useQuery<StaffUser[]>({
    queryKey: ['staff'],
    queryFn: async () => {
      const res = await usersApi.getAll();
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 30000,
  });
  const rolesQ = useQuery<Option[]>({
    queryKey: ['roles'],
    queryFn: async () => (await usersApi.getRoles()).data ?? [],
  });
  const deptsQ = useQuery<Option[]>({
    queryKey: ['departments'],
    queryFn: async () => (await departmentsApi.getAll()).data ?? [],
  });

  const staff = staffQ.data ?? [];
  const roles = Array.isArray(rolesQ.data) ? rolesQ.data : [];
  const depts = Array.isArray(deptsQ.data) ? deptsQ.data : [];

  const positions = useMemo(
    () =>
      Array.from(new Set(staff.map((u) => (u.position ?? '').trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [staff],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ['org-chart'] });

  const saveMut = useMutation({
    mutationFn: async (m: NonNullable<ModalState>) => {
      const f = m.form;
      const linked = f.linkType && f.linkValue;
      if (m.mode === 'edit' && m.id) {
        return orgChartApi.update(m.id, {
          title: f.title.trim(),
          subtitle: f.subtitle,
          department: f.department,
          location: f.location,
          headcount: f.headcount,
          status: f.status,
          parentId: f.parentId || null,
          linkType: linked ? (f.linkType as LinkType) : null,
          linkValue: linked ? f.linkValue : null,
          linkedUserId: f.linkedUserId || null,
        });
      }
      return orgChartApi.create({
        title: f.title.trim(),
        subtitle: f.subtitle || undefined,
        department: f.department || undefined,
        location: f.location || undefined,
        headcount: f.headcount,
        status: f.status,
        ...(f.parentId ? { parentId: f.parentId } : {}),
        ...(linked ? { linkType: f.linkType as LinkType, linkValue: f.linkValue } : {}),
        ...(f.linkedUserId ? { linkedUserId: f.linkedUserId } : {}),
      });
    },
    onSuccess: () => {
      setModal(null);
      invalidate();
    },
    onError: (e) => setFormError(errMsg(e, 'Save failed. Please try again.')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => orgChartApi.remove(id),
    onSuccess: () => {
      setSelectedId(null);
      invalidate();
    },
    onError: (e) => window.alert(errMsg(e, 'Delete failed.')),
  });

  const info = useMemo(() => computeInfo(tree, staff), [tree, staff]);
  const filtered = useMemo(() => filterTree(tree, search), [tree, search]);
  const activeStaff = useMemo(() => staff.filter((u) => u.status === 'active').length, [staff]);
  const headerCount = staffQ.isSuccess ? activeStaff : sumHeadcount(tree);
  const selected = findNode(tree, selectedId);
  const selectedInfo = selected ? info.get(selected.id) : undefined;
  const people = useMemo(
    () => (selectedInfo ? staff.filter((u) => selectedInfo.ids.has(u.id)) : []),
    [selectedInfo, staff],
  );

  const linkLabel = (n: OrgNode): string => {
    if (!n.linkType || !n.linkValue) return 'Not linked';
    if (n.linkType === 'role') return `Role: ${roles.find((r) => r.id === n.linkValue)?.name ?? 'unknown'}`;
    if (n.linkType === 'department')
      return `Department: ${depts.find((d) => d.id === n.linkValue)?.name ?? 'unknown'}`;
    return `Position: ${n.linkValue}`;
  };

  const openAdd = (parentId: string | null) => {
    setFormError('');
    setModal({ mode: 'add', form: emptyForm(parentId ?? '') });
  };

  const openEdit = (n: OrgNode) => {
    setFormError('');
    setModal({
      mode: 'edit',
      id: n.id,
      form: {
        title: n.title,
        subtitle: n.subtitle ?? '',
        department: n.department ?? '',
        location: n.location ?? '',
        headcount: n.headcount ?? 0,
        status: n.status,
        parentId: n.parentId ?? '',
        linkType: (n.linkType as LinkType) ?? '',
        linkValue: n.linkValue ?? '',
        linkedUserId: n.linkedUserId ?? '',
      },
    });
  };

  const submit = () => {
    if (!modal) return;
    if (!modal.form.title.trim()) {
      setFormError('Title is required.');
      return;
    }
    if (modal.form.linkType && !modal.form.linkValue) {
      setFormError('Choose what this role is linked to, or set the link type to "Not linked".');
      return;
    }
    setFormError('');
    saveMut.mutate(modal);
  };

  const confirmDelete = (n: OrgNode) => {
    const kids = n.children?.length ?? 0;
    const msg = kids
      ? `Delete "${n.title}"? Its ${kids} direct report role(s) will move to the top level.`
      : `Delete "${n.title}"?`;
    if (window.confirm(msg)) deleteMut.mutate(n.id);
  };

  // parent choices in the modal: everything except itself and its descendants
  const parentOptions = useMemo(() => {
    const all = flatten(tree);
    if (modal?.mode !== 'edit' || !modal.id) return all;
    const me = findNode(tree, modal.id);
    const blocked = me ? descendantIds(me) : new Set<string>();
    blocked.add(modal.id);
    return all.filter((o) => !blocked.has(o.node.id));
  }, [tree, modal]);

  const setField = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setModal((m) => (m ? { ...m, form: { ...m.form, [k]: v } } : m));

  const changeLinkType = (t: '' | LinkType) =>
    setModal((m) => (m ? { ...m, form: { ...m.form, linkType: t, linkValue: '' } } : m));

  return (
    <div className="flex min-h-full flex-col">
      <style>{CONNECTOR_CSS}</style>

      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Network size={18} className="text-red-800" />
          <h1 className="text-base font-semibold text-gray-900">Org chart</h1>
          <span
            className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-900"
            title={staffQ.isSuccess ? 'Active staff in the Staff section' : 'Manual headcounts'}
          >
            {headerCount} staff
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search role or department..."
              className="h-8 w-56 rounded-md border border-gray-300 pl-8 pr-2 text-sm focus:border-red-700 focus:outline-none"
            />
          </div>
          {canEdit && (
            <button
              onClick={() => openAdd(null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-red-900 px-3 text-sm font-medium text-white hover:bg-red-800"
            >
              <Plus size={14} /> Add role
            </button>
          )}
        </div>
      </div>

      {/* chart */}
      <div className="flex-1 overflow-auto bg-gray-50 p-8">
        {isLoading && <div className="py-10 text-center text-sm text-gray-500">Loading hierarchy…</div>}
        {error && (
          <div className="py-10 text-center text-sm text-red-600">{errMsg(error, 'Failed to load org chart.')}</div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-500">
            {search ? 'No roles match your search.' : 'No roles yet.'}
          </div>
        )}
        <div className="mx-auto flex w-max flex-col items-center gap-6">
          {filtered.map((n) => (
            <Branch
              key={n.id}
              node={n}
              depth={0}
              canEdit={canEdit}
              selectedId={selectedId}
              info={info}
              onSelect={setSelectedId}
              onAdd={openAdd}
              totalStaff={activeStaff}
            />
          ))}
        </div>
      </div>

      {/* detail panel */}
      {selected && (
        <div className="fixed right-5 top-20 z-40 flex max-h-[calc(100vh-7rem)] w-80 flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{selected.title}</div>
              {selected.subtitle && <div className="mt-0.5 text-xs text-red-800">{selected.subtitle}</div>}
            </div>
            <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
          <dl className="divide-y divide-gray-100 border-t border-gray-100 text-xs">
            <div className="flex justify-between py-1.5">
              <dt className="text-gray-500">Staff link</dt>
              <dd className="font-medium text-gray-900">{linkLabel(selected)}</dd>
            </div>
            <div className="flex justify-between gap-3 py-1.5">
              <dt className="shrink-0 text-gray-500">Approver</dt>
              <dd className="text-right font-medium text-gray-900">
                {selected.linkedUserId
                  ? (() => {
                      const u = staff.find((x) => x.id === selected.linkedUserId);
                      return u ? `${u.firstName} ${u.lastName}` : 'Linked user';
                    })()
                  : "None (their department head, else the box above)"}
              </dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-gray-500">Department</dt>
              <dd className="font-medium text-gray-900">{selected.department || '—'}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-gray-500">Location</dt>
              <dd className="font-medium text-gray-900">{selected.location || '—'}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-gray-500">Staff (active)</dt>
              <dd className="font-medium text-gray-900">{displayCount(selected, selectedInfo)}</dd>
            </div>
            <div className="flex justify-between py-1.5">
              <dt className="text-gray-500">Direct reports</dt>
              <dd className="font-medium text-gray-900">{selected.children?.length ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between py-1.5">
              <dt className="text-gray-500">Status</dt>
              <dd className="flex items-center gap-1.5 font-medium capitalize text-gray-900">
                <span
                  className={`h-2 w-2 rounded-full ${selected.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`}
                />
                {selected.status}
              </dd>
            </div>
          </dl>

          {selectedInfo?.linked && (
            <div className="mt-3 min-h-0 flex-1 overflow-y-auto border-t border-gray-100 pt-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">People ({people.length})</span>
                <Link to="/staff" className="text-[11px] text-red-800 hover:underline">
                  Open Staff directory
                </Link>
              </div>
              {people.length === 0 ? (
                <div className="text-xs text-gray-500">No active staff match this link yet.</div>
              ) : (
                <ul className="space-y-1.5">
                  {people.map((u) => (
                    <li key={u.id} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-[10px] font-semibold text-red-900">
                        {initials(u)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium text-gray-900">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className="block truncate text-[11px] text-gray-500">
                          {[u.position, u.department?.name].filter(Boolean).join(' · ') || '—'}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(canUpdate || canDelete) && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => openEdit(selected)}
                disabled={!canUpdate}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <Pencil size={12} /> Edit
              </button>
              <button
                onClick={() => confirmDelete(selected)}
                disabled={deleteMut.isPending || !canDelete}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-red-200 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* add / edit modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => e.target === e.currentTarget && setModal(null)}
        >
          <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">
                {modal.mode === 'edit' ? 'Edit role' : 'Add role'}
              </span>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  className={inputCls}
                  value={modal.form.title}
                  onChange={(e) => setField('title', e.target.value)}
                  placeholder="e.g. Ward Supervisor"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Subtitle</label>
                <input
                  className={inputCls}
                  value={modal.form.subtitle}
                  onChange={(e) => setField('subtitle', e.target.value)}
                  placeholder="e.g. Manages ward operations"
                />
              </div>

              {/* person in this role: drives expense approval routing */}
              <div>
                <label className="mb-1 block text-xs text-gray-500">
                  Person in this role <span className="text-gray-400">(approves expenses from staff below)</span>
                </label>
                <select
                  className={inputCls}
                  value={modal.form.linkedUserId}
                  onChange={(e) => setField('linkedUserId', e.target.value)}
                >
                  <option value="">None (goes to admin)</option>
                  {staff
                    .filter((u) => u.status === 'active')
                    .slice()
                    .sort((a, b) =>
                      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`),
                    )
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                        {u.position ? ` · ${u.position}` : ''}
                      </option>
                    ))}
                </select>
              </div>

              {/* staff link */}
              <div className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                <div className="mb-2 text-xs font-medium text-red-900">Staff link (live count and people)</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">Link to</label>
                    <select
                      className={inputCls}
                      value={modal.form.linkType}
                      onChange={(e) => changeLinkType(e.target.value as '' | LinkType)}
                    >
                      <option value="">Not linked</option>
                      <option value="role">Role</option>
                      <option value="department">Department</option>
                      <option value="position">Position</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      {modal.form.linkType === 'role'
                        ? 'Role'
                        : modal.form.linkType === 'department'
                        ? 'Department'
                        : modal.form.linkType === 'position'
                        ? 'Position'
                        : ' '}
                    </label>
                    {modal.form.linkType === 'role' && (
                      <select
                        className={inputCls}
                        value={modal.form.linkValue}
                        onChange={(e) => setField('linkValue', e.target.value)}
                      >
                        <option value="">Select role…</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {modal.form.linkType === 'department' && (
                      <select
                        className={inputCls}
                        value={modal.form.linkValue}
                        onChange={(e) => setField('linkValue', e.target.value)}
                      >
                        <option value="">Select department…</option>
                        {depts.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {modal.form.linkType === 'position' && (
                      <>
                        <input
                          className={inputCls}
                          list="oc-positions"
                          value={modal.form.linkValue}
                          onChange={(e) => setField('linkValue', e.target.value)}
                          placeholder="e.g. Charge Nurse"
                        />
                        <datalist id="oc-positions">
                          {positions.map((p) => (
                            <option key={p} value={p} />
                          ))}
                        </datalist>
                      </>
                    )}
                    {!modal.form.linkType && (
                      <div className="pt-1.5 text-[11px] text-gray-500">Uses the manual headcount below.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Department (label)</label>
                  <input
                    className={inputCls}
                    value={modal.form.department}
                    onChange={(e) => setField('department', e.target.value)}
                    placeholder="e.g. Nursing"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Location</label>
                  <input
                    className={inputCls}
                    value={modal.form.location}
                    onChange={(e) => setField('location', e.target.value)}
                    placeholder="e.g. Inpatient wing"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Manual headcount</label>
                  <input
                    className={inputCls}
                    type="number"
                    min={0}
                    value={modal.form.headcount}
                    onChange={(e) => setField('headcount', Math.max(0, Number(e.target.value) || 0))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-500">Status</label>
                  <select
                    className={inputCls}
                    value={modal.form.status}
                    onChange={(e) => setField('status', e.target.value as OrgStatus)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">Reports to</label>
                <select
                  className={inputCls}
                  value={modal.form.parentId}
                  onChange={(e) => setField('parentId', e.target.value)}
                >
                  <option value="">— Top level —</option>
                  {parentOptions.map(({ node, depth }) => (
                    <option key={node.id} value={node.id}>
                      {'— '.repeat(depth)}
                      {node.title}
                    </option>
                  ))}
                </select>
              </div>
              {formError && <div className="text-xs text-red-600">{formError}</div>}
            </div>
            <div className="flex justify-end gap-2 border-t border-gray-100 px-4 py-3">
              <button
                onClick={() => setModal(null)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saveMut.isPending}
                className="rounded-md bg-red-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {saveMut.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default OrgChartPage;
