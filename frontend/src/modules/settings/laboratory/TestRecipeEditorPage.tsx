import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  Search,
  Plus,
  Trash2,
  FlaskConical,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Lock,
} from 'lucide-react';
import { labTestCatalogApi, inventoryApi } from '../../../services/api';

// ─────────────────────────────────────────────────────────────────────────
// Types (mirror LabTestCatalogService.buildCosting / presentComponent output)
// ─────────────────────────────────────────────────────────────────────────

interface TestRow {
  id: string;
  name: string;
  category: string | null;
  price: number;
  active: boolean;
  isPanel: boolean;
  panelId: string | null;
}

interface LabSupplyOption {
  id: string;
  name: string;
  unit: string;
  stockQuantity: number;
  costPrice: number;
  isActive: boolean;
}

interface RecipeComponent {
  id?: string; // present once saved; absent for a freshly-added draft row
  labSupplyId: string;
  labSupplyName: string;
  labSupplyUnit: string | null;
  stockQuantity: number;
  quantityPerTest: number;
  wastagePercent: number;
  effectiveQuantity: number;
  unitCost: number;
  calculatedCost: number;
  notes: string | null;
}

interface CostBreakdown {
  id: string;
  name: string;
  category: string | null;
  sellingPrice: number;
  costCalculationMode: 'auto' | 'manual';
  autoCost: number;
  manualCostOverride: number | null;
  manualCostReason: string | null;
  manualAdjustment: number | null;
  effectiveCost: number;
  grossProfit: number;
  grossMargin: number;
  hasRecipe: boolean;
  components: RecipeComponent[];
}

function fmt(n: number) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────────────────

export function TestRecipeEditorPage() {
  const queryClient = useQueryClient();

  const [testSearch, setTestSearch] = useState('');
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);

  const [draftComponents, setDraftComponents] = useState<RecipeComponent[]>([]);
  const [supplySearch, setSupplySearch] = useState('');
  const [supplyPickerOpen, setSupplyPickerOpen] = useState(false);

  const [costModeOpen, setCostModeOpen] = useState(false);
  const [manualCost, setManualCost] = useState('');
  const [manualReason, setManualReason] = useState('');

  // ---- Tests list (left panel) ----
  const { data: tests, isLoading: testsLoading } = useQuery({
    queryKey: ['labTestCatalog', 'all'],
    queryFn: async () => {
      const res = await labTestCatalogApi.getAll();
      return res.data as TestRow[];
    },
  });

  // Recipes attach to billable tests, not panel-component rows (WBC lives
  // inside CBC's recipe, not its own) — same rule the backend costing
  // summary uses (`panel_id IS NULL`).
  const billableTests = useMemo(
    () => (tests ?? []).filter((t) => !t.panelId),
    [tests],
  );

  const filteredTests = useMemo(() => {
    const q = testSearch.toLowerCase();
    return billableTests.filter(
      (t) => !q || t.name.toLowerCase().includes(q) || (t.category ?? '').toLowerCase().includes(q),
    );
  }, [billableTests, testSearch]);

  // ---- Lab supplies (for the picker) ----
  const { data: supplies } = useQuery({
    queryKey: ['inventory', 'lab-supplies'],
    queryFn: async () => {
      const res = await inventoryApi.getLabSupplies();
      return res.data as LabSupplyOption[];
    },
  });

  const activeSupplies = useMemo(() => (supplies ?? []).filter((s) => s.isActive), [supplies]);

  const availableSupplies = useMemo(() => {
    const usedIds = new Set(draftComponents.map((c) => c.labSupplyId));
    const q = supplySearch.toLowerCase();
    return activeSupplies.filter(
      (s) => !usedIds.has(s.id) && (!q || s.name.toLowerCase().includes(q)),
    );
  }, [activeSupplies, draftComponents, supplySearch]);

  // ---- Selected test's cost breakdown / recipe ----
  const {
    data: costing,
    isLoading: costingLoading,
    isFetching: costingFetching,
  } = useQuery({
    queryKey: ['labTestCatalog', 'costBreakdown', selectedTestId],
    queryFn: async () => {
      const res = await labTestCatalogApi.getCostBreakdown(selectedTestId as string);
      return res.data as CostBreakdown;
    },
    enabled: !!selectedTestId,
  });

  // Seed the editable draft whenever a fresh (non-stale) breakdown arrives.
  useEffect(() => {
    if (costing && !costingFetching) {
      setDraftComponents(costing.components.map((c) => ({ ...c })));
      setManualCost(costing.manualCostOverride != null ? String(costing.manualCostOverride) : '');
      setManualReason(costing.manualCostReason ?? '');
    }
  }, [costing, costingFetching]);

  const selectedTest = billableTests.find((t) => t.id === selectedTestId) ?? null;

  // ---- Live cost preview over the draft (mirrors componentCost/buildCosting) ----
  const draftAutoCost = useMemo(() => {
    const sum = draftComponents.reduce((total, c) => {
      const effectiveQty = Number(c.quantityPerTest) * (1 + Number(c.wastagePercent) / 100);
      return total + effectiveQty * Number(c.unitCost);
    }, 0);
    return Math.round((sum + Number.EPSILON) * 100) / 100;
  }, [draftComponents]);

  const sellingPrice = Number(selectedTest?.price ?? 0);
  const isDirty = useMemo(() => {
    if (!costing) return false;
    if (costing.components.length !== draftComponents.length) return true;
    const saved = [...costing.components].sort((a, b) => a.labSupplyId.localeCompare(b.labSupplyId));
    const draft = [...draftComponents].sort((a, b) => a.labSupplyId.localeCompare(b.labSupplyId));
    return saved.some((s, i) => {
      const d = draft[i];
      return (
        !d ||
        s.labSupplyId !== d.labSupplyId ||
        Number(s.quantityPerTest) !== Number(d.quantityPerTest) ||
        Number(s.wastagePercent) !== Number(d.wastagePercent) ||
        (s.notes ?? '') !== (d.notes ?? '')
      );
    });
  }, [costing, draftComponents]);

  // ---- Mutations ----
  const saveComponentsMutation = useMutation({
    mutationFn: () =>
      labTestCatalogApi.setComponents(
        selectedTestId as string,
        draftComponents.map((c) => ({
          labSupplyId: c.labSupplyId,
          quantityPerTest: Number(c.quantityPerTest),
          wastagePercent: Number(c.wastagePercent) || 0,
          notes: c.notes || undefined,
        })),
      ),
    onSuccess: (res) => {
      queryClient.setQueryData(['labTestCatalog', 'costBreakdown', selectedTestId], res.data);
      queryClient.invalidateQueries({ queryKey: ['labTestCatalog', 'costing'] });
    },
  });

  const saveCostModeMutation = useMutation({
    mutationFn: (mode: 'auto' | 'manual') =>
      labTestCatalogApi.setCostMode(selectedTestId as string, {
        costCalculationMode: mode,
        manualCostOverride: mode === 'manual' ? Number(manualCost) : undefined,
        manualCostReason: mode === 'manual' ? manualReason : undefined,
      }),
    onSuccess: (res) => {
      queryClient.setQueryData(['labTestCatalog', 'costBreakdown', selectedTestId], res.data);
      setCostModeOpen(false);
    },
  });

  function selectTest(id: string) {
    setSelectedTestId(id);
    setSupplyPickerOpen(false);
    setSupplySearch('');
    setCostModeOpen(false);
  }

  function addSupply(s: LabSupplyOption) {
    setDraftComponents((rows) => [
      ...rows,
      {
        labSupplyId: s.id,
        labSupplyName: s.name,
        labSupplyUnit: s.unit,
        stockQuantity: s.stockQuantity,
        quantityPerTest: 1,
        wastagePercent: 0,
        effectiveQuantity: 1,
        unitCost: Number(s.costPrice),
        calculatedCost: Number(s.costPrice),
        notes: null,
      },
    ]);
    setSupplySearch('');
    setSupplyPickerOpen(false);
  }

  function updateRow(labSupplyId: string, patch: Partial<RecipeComponent>) {
    setDraftComponents((rows) => rows.map((r) => (r.labSupplyId === labSupplyId ? { ...r, ...patch } : r)));
  }

  function removeRow(labSupplyId: string) {
    setDraftComponents((rows) => rows.filter((r) => r.labSupplyId !== labSupplyId));
  }

  const inputClass =
    'w-full px-2.5 py-1.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold text-clinical-400 uppercase tracking-wide">Laboratory Settings</p>
        <h1 className="text-2xl font-bold text-clinical-900 mt-0.5">Test Recipes (Bill of Materials)</h1>
        <p className="text-clinical-500 text-sm mt-1">
          Configure which lab supplies each test consumes, so stock deducts automatically and costs stay accurate.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5">
        {/* ---- Left: test list ---- */}
        <div className="bg-white rounded-xl border border-clinical-200 flex flex-col max-h-[720px]">
          <div className="p-3 border-b border-clinical-200">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
              <input
                value={testSearch}
                onChange={(e) => setTestSearch(e.target.value)}
                placeholder="Search tests…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {testsLoading ? (
              <div className="flex items-center justify-center py-12 text-clinical-400">
                <Loader2 size={18} className="animate-spin" />
              </div>
            ) : filteredTests.length === 0 ? (
              <p className="text-center text-clinical-400 text-xs py-10">No tests found</p>
            ) : (
              filteredTests.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTest(t.id)}
                  className={`w-full text-left px-4 py-3 border-b border-clinical-50 hover:bg-clinical-50 transition-colors ${
                    t.id === selectedTestId ? 'bg-primary-50' : ''
                  }`}
                >
                  <p className={`text-sm font-semibold ${t.id === selectedTestId ? 'text-primary-700' : 'text-clinical-800'}`}>
                    {t.name}
                  </p>
                  <p className="text-xs text-clinical-400 mt-0.5">
                    {t.category ?? 'Uncategorized'} · {fmt(t.price)}
                    {!t.active && ' · Inactive'}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ---- Right: recipe editor ---- */}
        <div className="bg-white rounded-xl border border-clinical-200 p-6">
          {!selectedTestId ? (
            <div className="flex flex-col items-center justify-center py-24 text-clinical-400">
              <FlaskConical size={28} className="mb-2" />
              <p className="text-sm">Select a test to view or edit its recipe</p>
            </div>
          ) : costingLoading || !costing ? (
            <div className="flex items-center justify-center py-24 text-clinical-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading recipe…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-lg font-bold text-clinical-900">{costing.name}</h2>
                  <p className="text-xs text-clinical-400 mt-0.5">{costing.category ?? 'Uncategorized'}</p>
                </div>
                <button
                  onClick={() => setCostModeOpen((v) => !v)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-clinical-600 border border-clinical-200 rounded-lg px-3 py-2 hover:bg-clinical-50"
                >
                  <Lock size={13} />
                  {costing.costCalculationMode === 'manual' ? 'Manual cost override active' : 'Cost mode: Auto'}
                </button>
              </div>

              {/* Cost-mode panel */}
              {costModeOpen && (
                <div className="bg-clinical-50 border border-clinical-200 rounded-xl p-4 space-y-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => saveCostModeMutation.mutate('auto')}
                      disabled={saveCostModeMutation.isPending}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        costing.costCalculationMode === 'auto'
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-clinical-600 border-clinical-200 hover:bg-clinical-100'
                      }`}
                    >
                      Auto (from recipe)
                    </button>
                    <button
                      onClick={() => setManualCost(manualCost || String(costing.autoCost))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                        costing.costCalculationMode === 'manual'
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'bg-white text-clinical-600 border-clinical-200 hover:bg-clinical-100'
                      }`}
                    >
                      Manual override
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-clinical-600 mb-1">Manual cost</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={manualCost}
                        onChange={(e) => setManualCost(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-clinical-600 mb-1">Reason *</label>
                      <input
                        value={manualReason}
                        onChange={(e) => setManualReason(e.target.value)}
                        placeholder="e.g. Sent to reference lab"
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => saveCostModeMutation.mutate('manual')}
                    disabled={!manualCost || !manualReason.trim() || saveCostModeMutation.isPending}
                    className="text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg px-3 py-2 disabled:opacity-50"
                  >
                    {saveCostModeMutation.isPending ? 'Saving…' : 'Save manual override'}
                  </button>
                </div>
              )}

              {/* Recipe table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-clinical-500 uppercase tracking-wide">Recipe</p>
                  <div className="relative">
                    <button
                      onClick={() => setSupplyPickerOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                    >
                      <Plus size={14} /> Add supply
                    </button>
                    {supplyPickerOpen && (
                      <div className="absolute right-0 mt-2 w-72 bg-white border border-clinical-200 rounded-xl shadow-xl z-10">
                        <div className="p-2 border-b border-clinical-100">
                          <input
                            autoFocus
                            value={supplySearch}
                            onChange={(e) => setSupplySearch(e.target.value)}
                            placeholder="Search lab supplies…"
                            className="w-full px-2.5 py-1.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
                          />
                        </div>
                        <div className="max-h-64 overflow-y-auto">
                          {availableSupplies.length === 0 ? (
                            <p className="text-xs text-clinical-400 text-center py-6">No matching supplies</p>
                          ) : (
                            availableSupplies.map((s) => (
                              <button
                                key={s.id}
                                onClick={() => addSupply(s)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-clinical-50 flex items-center justify-between"
                              >
                                <span className="text-clinical-800">{s.name}</span>
                                <span className="text-xs text-clinical-400">{fmt(s.costPrice)}/{s.unit}</span>
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {draftComponents.length === 0 ? (
                  <div className="border border-dashed border-clinical-200 rounded-xl py-10 text-center">
                    <AlertCircle size={18} className="mx-auto text-clinical-300 mb-1.5" />
                    <p className="text-xs text-clinical-400">
                      No recipe configured yet — stock won't deduct automatically for this test.
                    </p>
                  </div>
                ) : (
                  <div className="border border-clinical-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-clinical-100 bg-clinical-50">
                          <th className="text-left px-3 py-2 text-xs font-bold text-clinical-500 uppercase tracking-wide">Supply</th>
                          <th className="text-left px-3 py-2 text-xs font-bold text-clinical-500 uppercase tracking-wide w-24">Qty/test</th>
                          <th className="text-left px-3 py-2 text-xs font-bold text-clinical-500 uppercase tracking-wide w-24">Wastage %</th>
                          <th className="text-left px-3 py-2 text-xs font-bold text-clinical-500 uppercase tracking-wide">Notes</th>
                          <th className="text-right px-3 py-2 text-xs font-bold text-clinical-500 uppercase tracking-wide w-24">Cost</th>
                          <th className="px-2 py-2 w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-clinical-50">
                        {draftComponents.map((c) => {
                          const effectiveQty = Number(c.quantityPerTest) * (1 + Number(c.wastagePercent) / 100);
                          const rowCost = Math.round((effectiveQty * Number(c.unitCost) + Number.EPSILON) * 100) / 100;
                          const lowStock = c.stockQuantity < Number(c.quantityPerTest);
                          return (
                            <tr key={c.labSupplyId} className="hover:bg-clinical-50/60">
                              <td className="px-3 py-2">
                                <p className="font-medium text-clinical-800">{c.labSupplyName}</p>
                                <p className={`text-[11px] mt-0.5 ${lowStock ? 'text-red-600 font-semibold' : 'text-clinical-400'}`}>
                                  {lowStock && <AlertCircle size={10} className="inline mr-0.5 -mt-0.5" />}
                                  {c.stockQuantity} {c.labSupplyUnit ?? 'unit'} in stock
                                </p>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={1}
                                  value={c.quantityPerTest}
                                  onChange={(e) => updateRow(c.labSupplyId, { quantityPerTest: Number(e.target.value) || 1 })}
                                  className="w-full px-2 py-1 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.5"
                                  value={c.wastagePercent}
                                  onChange={(e) => updateRow(c.labSupplyId, { wastagePercent: Number(e.target.value) || 0 })}
                                  className="w-full px-2 py-1 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  value={c.notes ?? ''}
                                  onChange={(e) => updateRow(c.labSupplyId, { notes: e.target.value })}
                                  placeholder="Optional"
                                  className="w-full px-2 py-1 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                />
                              </td>
                              <td className="px-3 py-2 text-right text-clinical-700 font-medium">{fmt(rowCost)}</td>
                              <td className="px-2 py-2">
                                <button
                                  onClick={() => removeRow(c.labSupplyId)}
                                  className="w-7 h-7 flex items-center justify-center rounded-lg text-clinical-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="flex items-center justify-between mt-3">
                  {saveComponentsMutation.isError && (
                    <p className="text-red-600 text-xs">
                      {(saveComponentsMutation.error as any)?.response?.data?.message || "Couldn't save the recipe."}
                    </p>
                  )}
                  {saveComponentsMutation.isSuccess && !isDirty && (
                    <p className="text-green-600 text-xs">Recipe saved.</p>
                  )}
                  <div className="ml-auto">
                    <button
                      onClick={() => saveComponentsMutation.mutate()}
                      disabled={!isDirty || saveComponentsMutation.isPending}
                      className="px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                    >
                      {saveComponentsMutation.isPending ? 'Saving…' : 'Save recipe'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Cost summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-clinical-100">
                <div className="bg-clinical-50 rounded-lg p-3">
                  <p className="text-[11px] text-clinical-400 uppercase tracking-wide">Selling price</p>
                  <p className="text-sm font-bold text-clinical-900 mt-0.5">{fmt(sellingPrice)}</p>
                </div>
                <div className="bg-clinical-50 rounded-lg p-3">
                  <p className="text-[11px] text-clinical-400 uppercase tracking-wide flex items-center gap-1">
                    <DollarSign size={11} /> Recipe cost {isDirty && '(unsaved)'}
                  </p>
                  <p className="text-sm font-bold text-clinical-900 mt-0.5">{fmt(draftAutoCost)}</p>
                </div>
                <div className="bg-clinical-50 rounded-lg p-3">
                  <p className="text-[11px] text-clinical-400 uppercase tracking-wide">Effective cost</p>
                  <p className="text-sm font-bold text-clinical-900 mt-0.5">
                    {fmt(costing.costCalculationMode === 'manual' ? costing.effectiveCost : draftAutoCost)}
                  </p>
                </div>
                <div className="bg-clinical-50 rounded-lg p-3">
                  <p className="text-[11px] text-clinical-400 uppercase tracking-wide flex items-center gap-1">
                    <TrendingUp size={11} /> Gross margin
                  </p>
                  <p className="text-sm font-bold text-clinical-900 mt-0.5">
                    {sellingPrice > 0
                      ? `${Math.round(
                          ((sellingPrice - (costing.costCalculationMode === 'manual' ? costing.effectiveCost : draftAutoCost)) /
                            sellingPrice) *
                            100,
                        )}%`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
