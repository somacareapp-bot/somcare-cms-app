import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Pill, Plus, Pencil, PackagePlus, Search, Package, DollarSign, AlertCircle, Clock, Tag } from 'lucide-react';
import { pharmacyApi } from '../../services/api';
import { ExcelImportExport } from '../../components/ExcelImportExport';
import { medicineExcelFields } from '../../utils/excelFieldConfigs';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
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

const categoryOptions = ['tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'other'];

const emptyForm = {
  name: '', genericName: '', category: 'tablet', unit: 'tablet',
  stockQuantity: 0, reorderLevel: 10, costPrice: 0, sellPrice: 0, batchNumber: '', expiryDate: '',
};

export function MedicinesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [restockQty, setRestockQty] = useState('');

  const { data: medicines, isLoading } = useQuery({
    queryKey: ['pharmacy', 'medicines', search],
    queryFn: async () => {
      const res = await pharmacyApi.getMedicines(search || undefined);
      return res.data as Medicine[];
    },
  });

  const stats = useMemo(() => {
    const all = medicines ?? [];
    const soonThreshold = new Date();
    soonThreshold.setDate(soonThreshold.getDate() + 30);
    return {
      totalCount: all.length,
      totalValue: all.reduce((sum, m) => sum + Number(m.costPrice) * m.stockQuantity, 0),
      retailValue: all.reduce((sum, m) => sum + Number(m.sellPrice) * m.stockQuantity, 0),
      lowStockCount: all.filter((m) => m.stockQuantity <= m.reorderLevel).length,
      expiringSoonCount: all.filter((m) => m.expiryDate && new Date(m.expiryDate) <= soonThreshold).length,
    };
  }, [medicines]);

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId ? pharmacyApi.updateMedicine(editingId, form) : pharmacyApi.createMedicine(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      closeModal();
    },
  });

  const restockMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => pharmacyApi.restockMedicine(id, quantity),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setRestockId(null);
      setRestockQty('');
    },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(m: Medicine) {
    setEditingId(m.id);
    setForm({
      name: m.name, genericName: m.genericName ?? '', category: m.category, unit: m.unit,
      stockQuantity: m.stockQuantity, reorderLevel: m.reorderLevel,
      costPrice: m.costPrice, sellPrice: m.sellPrice,
      batchNumber: m.batchNumber ?? '', expiryDate: m.expiryDate ? m.expiryDate.slice(0, 10) : '',
    });
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
            <Pill size={22} className="text-primary-600" /> Medicines
          </h1>
          <p className="text-clinical-500 text-sm mt-1">Manage the pharmacy's medicine inventory.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <ExcelImportExport
          title="Medicines"
          fields={medicineExcelFields}
          rows={medicines ?? []}
          getAllRows={() => pharmacyApi.getMedicines().then((r) => r.data)}
          onCreate={(d) => pharmacyApi.createMedicine(d)}
          onUpdate={(id, d) => pharmacyApi.updateMedicine(id, d)}
          onDone={() => queryClient.invalidateQueries({ queryKey: ['pharmacy'] })}
        />
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700"
        >
          <Plus size={15} /> Add Medicine
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
            <p className="text-xs text-clinical-400">Total Medicines</p>
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
          placeholder="Search medicines…"
          className="w-full pl-9 pr-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
        />
      </div>

      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-clinical-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : !medicines || medicines.length === 0 ? (
          <p className="text-center text-clinical-400 text-sm py-16">No medicines found</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-clinical-100 bg-clinical-50">
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Category</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Stock</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Cost / Sell</th>
                <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Expiry</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-clinical-50">
              {medicines.map((m) => (
                <tr key={m.id} className="hover:bg-clinical-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-clinical-900">{m.name}</p>
                    {m.genericName && <p className="text-xs text-clinical-400">{m.genericName}</p>}
                  </td>
                  <td className="px-4 py-3 text-clinical-600 capitalize">{m.category}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold ${m.stockQuantity <= m.reorderLevel ? 'text-red-600' : 'text-clinical-800'}`}>
                      {m.stockQuantity} {m.unit}(s)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-clinical-600">
                    <span className="text-clinical-500">${Number(m.costPrice).toFixed(2)}</span>
                    {' / '}
                    <span className="font-semibold text-primary-600">${Number(m.sellPrice).toFixed(2)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-clinical-400">
                    {m.expiryDate ? new Date(m.expiryDate).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {restockId === m.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min={1}
                            value={restockQty}
                            onChange={(e) => setRestockQty(e.target.value)}
                            placeholder="Qty"
                            className="w-20 border border-clinical-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-primary-500"
                          />
                          <button
                            onClick={() => restockQty && restockMutation.mutate({ id: m.id, quantity: Number(restockQty) })}
                            disabled={!restockQty || restockMutation.isPending}
                            className="text-xs font-semibold text-white bg-primary-600 rounded-lg px-2.5 py-1.5 hover:bg-primary-700 disabled:opacity-50"
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setRestockId(null); setRestockQty(''); }}
                            className="text-xs font-semibold text-clinical-500 border border-clinical-200 rounded-lg px-2.5 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setRestockId(m.id); setRestockQty(''); }}
                          className="flex items-center gap-1 text-xs font-semibold text-primary-600 border border-primary-200 rounded-lg px-2.5 py-1.5 hover:bg-primary-50"
                        >
                          <PackagePlus size={13} /> Restock
                        </button>
                      )}
                      <button
                        onClick={() => openEdit(m)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-clinical-200 text-clinical-400 hover:text-clinical-700 hover:border-clinical-300"
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-clinical-900">{editingId ? 'Edit Medicine' : 'Add Medicine'}</h2>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-clinical-600 mb-1">Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-clinical-600 mb-1">Generic Name</label>
                <input value={form.genericName} onChange={(e) => setForm({ ...form, genericName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Category</label>
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputClass}>
                  {categoryOptions.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Unit</label>
                <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={inputClass} placeholder="e.g. tablet, bottle" />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Stock Quantity</label>
                <input type="number" min={0} value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: Number(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Reorder Level</label>
                <input type="number" min={0} value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Cost Price</label>
                <input type="number" min={0} step="0.01" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs font-medium text-clinical-600 mb-1">Sell Price</label>
                <input type="number" min={0} step="0.01" value={form.sellPrice} onChange={(e) => setForm({ ...form, sellPrice: Number(e.target.value) })} className={inputClass} />
              </div>
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
              <p className="text-red-600 text-xs">Couldn't save this medicine. Check the form and try again.</p>
            )}

            <div className="flex justify-end gap-3 pt-2 border-t border-clinical-100">
              <button onClick={closeModal} className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50">
                Cancel
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!form.name || saveMutation.isPending}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving…' : 'Save Medicine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
