import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Search, Pencil, PackagePlus, PackageMinus, Trash2, AlertCircle, Package, DollarSign, Clock, Tag } from 'lucide-react';
import { inventoryApi } from '../../services/api';
import { ExcelImportExport } from '../../components/ExcelImportExport';
import { labSupplyExcelFields } from '../../utils/excelFieldConfigs';

interface LabSupplyRow {
  id: string;
  name: string;
  category: string;
  unit: string;
  stockQuantity: number;
  reorderLevel: number;
  costPrice: number;
  sellPrice: number;
  batchNumber?: string;
  expiryDate?: string;
  isActive: boolean;
}

const CATEGORIES = [
  'reagent', 'consumable', 'equipment', 'ppe', 'other',
  'blood_collection', 'specimen_containers', 'specimen_collection', 'microscopy',
  'laboratory_supplies', 'rapid_test_kits', 'biochemistry', 'hematology',
  'blood_banking', 'quality_control', 'cleaning_supplies', 'waste_management',
];

function categoryLabel(cat: string) {
  return cat.split('_').map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ');
}

const emptyForm = {
  name: '',
  category: 'consumable',
  unit: 'unit',
  stockQuantity: '',
  reorderLevel: '10',
  costPrice: '',
  sellPrice: '',
  batchNumber: '',
  expiryDate: '',
};

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

export function LabSuppliesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LabSupplyRow | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [restockTarget, setRestockTarget] = useState<LabSupplyRow | null>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockReason, setRestockReason] = useState('');
  const [issueTarget, setIssueTarget] = useState<LabSupplyRow | null>(null);
  const [issueQty, setIssueQty] = useState('');
  const [issueReason, setIssueReason] = useState('');

  const { data: supplies, isLoading } = useQuery({
    queryKey: ['inventory', 'lab-supplies'],
    queryFn: async () => {
      const res = await inventoryApi.getLabSupplies();
      return res.data as LabSupplyRow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        category: form.category,
        unit: form.unit,
        stockQuantity: Number(form.stockQuantity) || 0,
        reorderLevel: Number(form.reorderLevel) || 0,
        costPrice: Number(form.costPrice) || 0,
        sellPrice: Number(form.sellPrice) || 0,
        batchNumber: form.batchNumber || undefined,
        expiryDate: form.expiryDate || undefined,
      };
      return editing ? inventoryApi.updateLabSupply(editing.id, payload) : inventoryApi.createLabSupply(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeModal();
    },
  });

  const restockMutation = useMutation({
    mutationFn: ({ id, quantity, reason }: { id: string; quantity: number; reason?: string }) =>
      inventoryApi.restockLabSupply(id, quantity, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setRestockTarget(null);
      setRestockQty('');
      setRestockReason('');
    },
  });

  const issueMutation = useMutation({
    mutationFn: ({ id, quantity, reason }: { id: string; quantity: number; reason?: string }) =>
      inventoryApi.issueLabSupply(id, quantity, reason || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setIssueTarget(null);
      setIssueQty('');
      setIssueReason('');
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.deactivateLabSupply(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory'] }),
  });

  const all = supplies ?? [];

  const stats = useMemo(() => {
    const soonThreshold = new Date();
    soonThreshold.setDate(soonThreshold.getDate() + 30);
    return {
      totalCount: all.length,
      totalValue: all.reduce((sum, s) => sum + Number(s.costPrice) * s.stockQuantity, 0),
      retailValue: all.reduce((sum, s) => sum + Number(s.sellPrice) * s.stockQuantity, 0),
      lowStockCount: all.filter((s) => s.stockQuantity <= s.reorderLevel).length,
      expiringSoonCount: all.filter((s) => s.expiryDate && new Date(s.expiryDate) <= soonThreshold).length,
    };
  }, [all]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return all.filter((s) => !q || s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [all, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  }
  function openEdit(s: LabSupplyRow) {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      unit: s.unit,
      stockQuantity: String(s.stockQuantity),
      reorderLevel: String(s.reorderLevel),
      costPrice: String(s.costPrice),
      sellPrice: String(s.sellPrice ?? 0),
      batchNumber: s.batchNumber ?? '',
      expiryDate: s.expiryDate ? s.expiryDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }
  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500";
  const canSubmit = !!form.name;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900">Laboratory Supplies</h1>
          <p className="text-clinical-500 text-sm mt-1">Reagents, consumables and equipment stock.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <ExcelImportExport
          title="Lab Supplies"
          fields={labSupplyExcelFields}
          rows={supplies ?? []}
          onCreate={(d) => inventoryApi.createLabSupply(d)}
          onUpdate={(id, d) => inventoryApi.updateLabSupply(id, d)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['inventory'] })}
        />
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700"
        >
          <Plus size={15} /> New Supply
        </button>
      </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center flex-shrink-0">
            <Package size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{stats.totalCount}</p>
            <p className="text-xs text-clinical-400">Total Supplies</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
            <DollarSign size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">${stats.totalValue.toFixed(2)}</p>
            <p className="text-xs text-clinical-400">Total Stock Value</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
            <Tag size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">${stats.retailValue.toFixed(2)}</p>
            <p className="text-xs text-clinical-400">Retail Value</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-red-50 text-red-600 flex items-center justify-center flex-shrink-0">
            <AlertCircle size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{stats.lowStockCount}</p>
            <p className="text-xs text-clinical-400">Low Stock Items</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-clinical-200 p-5 flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Clock size={19} />
          </div>
          <div>
            <p className="text-xl font-bold text-clinical-900">{stats.expiringSoonCount}</p>
            <p className="text-xs text-clinical-400">Expiring Soon (30d)</p>
          </div>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplies…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-clinical-400 text-sm py-16">No lab supplies found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinical-100 bg-clinical-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Reorder Level</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Cost Price</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Sell Price</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-50">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-clinical-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-clinical-800">{s.name}</td>
                  <td className="px-4 py-3 text-clinical-600">{categoryLabel(s.category)}</td>
                  <td className="px-4 py-3">
                    <span className={s.stockQuantity <= s.reorderLevel ? 'text-red-600 font-semibold flex items-center gap-1' : 'text-clinical-700'}>
                      {s.stockQuantity <= s.reorderLevel && <AlertCircle size={13} />}
                      {s.stockQuantity} {s.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-clinical-500">{s.reorderLevel}</td>
                  <td className="px-4 py-3 text-clinical-700">{fmt(Number(s.costPrice))}</td>
                  <td className="px-4 py-3 text-clinical-700">{fmt(Number(s.sellPrice))}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 justify-end">
                      <button onClick={() => setRestockTarget(s)} title="Restock" className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100">
                        <PackagePlus size={15} />
                      </button>
                      <button onClick={() => setIssueTarget(s)} title="Issue Stock" className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100">
                        <PackageMinus size={15} />
                      </button>
                      <button onClick={() => openEdit(s)} title="Edit" className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => deactivateMutation.mutate(s.id)} title="Deactivate" className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-red-600 hover:bg-red-50">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-clinical-900">{editing ? 'Edit Supply' : 'New Supply'}</h2>

            <div>
              <label className="block text-xs font-medium text-clinical-600 mb-1">Name *</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Unit</label>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Stock Quantity</label>
                <input type="number" min={0} value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Reorder Level</label>
                <input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Cost Price</label>
                <input type="number" min={0} step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Sell Price</label>
                <input type="number" min={0} step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: e.target.value })} className={inputClass} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Batch Number</label>
                <input value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Expiry Date</label>
                <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className={inputClass} />
              </div>
            </div>

            {saveMutation.isError && (
              <p className="text-red-600 text-xs">Couldn't save this supply. Check the form and try again.</p>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!canSubmit || saveMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Supply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restock modal */}
      {restockTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRestockTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-clinical-900">Restock</h2>
            <p className="text-xs text-clinical-500">{restockTarget.name} · currently {restockTarget.stockQuantity} {restockTarget.unit}</p>
            <input
              type="number" min={1}
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              placeholder="Quantity to add"
              autoFocus
              className={inputClass}
            />
            <div>
              <label className="block text-xs font-medium text-clinical-600 mb-1">Reason (optional)</label>
              <input
                value={restockReason}
                onChange={(e) => setRestockReason(e.target.value)}
                placeholder="e.g. Purchase order, supplier delivery"
                className={inputClass}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
              <button onClick={() => { setRestockTarget(null); setRestockReason(''); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => restockQty && restockMutation.mutate({ id: restockTarget.id, quantity: Number(restockQty), reason: restockReason })}
                disabled={!restockQty || restockMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {restockMutation.isPending ? 'Saving…' : 'Add Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Stock modal */}
      {issueTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setIssueTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-clinical-900">Issue Stock</h2>
            <p className="text-xs text-clinical-500">{issueTarget.name} · currently {issueTarget.stockQuantity} {issueTarget.unit}</p>
            <input
              type="number" min={1} max={issueTarget.stockQuantity}
              value={issueQty}
              onChange={(e) => setIssueQty(e.target.value)}
              placeholder="Quantity to issue"
              autoFocus
              className={inputClass}
            />
            <div>
              <label className="block text-xs font-medium text-clinical-600 mb-1">Reason *</label>
              <input
                value={issueReason}
                onChange={(e) => setIssueReason(e.target.value)}
                placeholder="e.g. Used — walk-in CBC, Wastage, Expired — disposed"
                className={inputClass}
              />
            </div>
            {issueMutation.isError && (
              <p className="text-red-600 text-xs">
                {(issueMutation.error as any)?.response?.data?.message || "Couldn't issue stock. Check the quantity and try again."}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
              <button onClick={() => { setIssueTarget(null); setIssueQty(''); setIssueReason(''); }} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => issueQty && issueReason && issueMutation.mutate({ id: issueTarget.id, quantity: Number(issueQty), reason: issueReason })}
                disabled={!issueQty || !issueReason || issueMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {issueMutation.isPending ? 'Saving…' : 'Issue Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
