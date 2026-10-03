import { useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Loader2,
  ShoppingCart,
  Search,
  Trash2,
  Printer,
  ShoppingBag,
  User,
  Users,
  X,
  Pause,
  RotateCcw,
  ClipboardList,
  AlertTriangle,
  CalendarClock,
  TrendingUp,
  ChevronRight,
  Plus,
  Banknote,
  Smartphone,
  Landmark,
  CreditCard,
} from 'lucide-react';
import { pharmacyApi, patientsApi } from '../../services/api';
import { getMedicineIcon, TILE_COLORS } from './MedicineIcons';

// Edit this to your pharmacy's details — used on the printed receipt.
const PHARMACY_INFO = {
  name: 'AL-HIJRA PHARMACY',
  tagline: 'Your Health, Our Priority',
  addressLine1: '20/25, PC Culture, Ring Road',
  addressLine2: 'Dhaka-12107, Bangladesh',
  phone: '+880 1234-567890',
  email: 'info@alhijrapharmacy.com',
};

const VAT_RATE = 0.05;
const EXPIRING_SOON_DAYS = 30;
const HELD_SALES_KEY = 'pos_held_sales_v1';

interface Medicine {
  id: string;
  name: string;
  genericName?: string;
  category: string;
  unit: string;
  stockQuantity: number;
  reorderLevel?: number;
  sellPrice: number;
  batchNumber?: string;
  expiryDate?: string;
}

interface Patient {
  id: string;
  patientNumber: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  phone?: string;
}

const CATEGORIES = ['all', 'tablet', 'capsule', 'syrup', 'injection', 'ointment', 'drops', 'other'];

// Generic per-category art (no photo upload needed) — one emoji per
// MedicineCategory value, plus a rotating pastel background so the list
// doesn't look flat when several items share a category.
const CATEGORY_EMOJI: Record<string, string> = {
  tablet: '💊',
  capsule: '💊',
  syrup: '🧴',
  injection: '💉',
  ointment: '🩹',
  drops: '💧',
  other: '📦',
};

const CARD_TINTS = [
  'bg-pink-100',
  'bg-blue-100',
  'bg-amber-100',
  'bg-green-100',
  'bg-purple-100',
  'bg-orange-100',
  'bg-cyan-100',
];

function tintFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_TINTS[hash % CARD_TINTS.length];
}

interface CartLine {
  medicineId: string;
  name: string;
  genericName?: string;
  unit: string;
  sellPrice: number;
  maxStock: number;
  quantity: number;
  batchNumber?: string;
  expiryDate?: string;
}

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: Banknote, tint: 'bg-clinical-100 text-clinical-600' },
  { value: 'zaad', label: 'ZAAD', icon: Smartphone, tint: 'bg-green-100 text-green-600' },
  { value: 'edahab', label: 'E-DAHAB', icon: Smartphone, tint: 'bg-amber-100 text-amber-600' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: Landmark, tint: 'bg-blue-100 text-blue-600' },
  { value: 'credit', label: 'Credit', icon: CreditCard, tint: 'bg-clinical-100 text-clinical-600' },
];

interface HeldSale {
  id: string;
  savedAt: string;
  cart: CartLine[];
  selectedPatient: Patient | null;
  walkInName: string;
  walkInPhone: string;
  discountAmount: string;
  notes: string;
}

function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}

function patientFullName(p: Patient) {
  return [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' ');
}

function loadHeldSales(): HeldSale[] {
  try {
    const raw = localStorage.getItem(HELD_SALES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHeldSales(sales: HeldSale[]) {
  try {
    localStorage.setItem(HELD_SALES_KEY, JSON.stringify(sales));
  } catch {
    // localStorage unavailable (e.g. private browsing) — silently no-op,
    // Hold Sale just won't persist across reloads.
  }
}

export function POSPage() {
  const queryClient = useQueryClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState<CartLine[]>([]);

  // Patient Information: search an existing patient, or fall back to
  // typing a walk-in name/phone directly (same as before dispensing owned
  // its own "Prescription verified" banner — that's dropped here entirely).
  const [patientQuery, setPatientQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');

  const [notes, setNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paidAmount, setPaidAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [receipt, setReceipt] = useState<any>(null);

  const [heldSales, setHeldSales] = useState<HeldSale[]>(() => loadHeldSales());
  const [showHeldSales, setShowHeldSales] = useState(false);

  const { data: medicines, isLoading } = useQuery({
    queryKey: ['pharmacy', 'medicines', 'pos-search', search],
    queryFn: async () => {
      const res = await pharmacyApi.getMedicines(search || undefined);
      return res.data as Medicine[];
    },
  });

  // NOTE: assumes `pharmacyApi.getSales()` exists (GET /api/pharmacy/sales,
  // matching the backend's existing `findSales()` service method). If your
  // api.ts doesn't have it yet, add:
  //   getSales: () => api.get('/api/pharmacy/sales'),
  // to the pharmacyApi block in services/api.ts.
  const { data: allSales } = useQuery({
    queryKey: ['pharmacy', 'sales', 'all'],
    queryFn: async () => {
      const res = await pharmacyApi.getSales();
      return res.data as any[];
    },
  });

  const { data: patientResults, isFetching: isSearchingPatients } = useQuery({
    queryKey: ['patients', 'search', patientQuery],
    queryFn: async () => {
      const res = await patientsApi.search(patientQuery);
      return res.data as Patient[];
    },
    enabled: patientQuery.trim().length >= 2 && !selectedPatient,
  });

  const saleMutation = useMutation({
    mutationFn: () =>
      pharmacyApi.createSale({
        patientId: selectedPatient?.id || undefined,
        customerName: selectedPatient ? patientFullName(selectedPatient) : walkInName || undefined,
        customerPhone: selectedPatient ? selectedPatient.phone : walkInPhone || undefined,
        discountAmount: Number(discountAmount) || 0,
        paidAmount: paidAmount ? Number(paidAmount) : undefined,
        paymentMethod,
        notes: notes || undefined,
        items: cart.map((c) => ({ medicineId: c.medicineId, quantity: c.quantity })),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['pharmacy'] });
      setReceipt(res.data);
      resetSaleForm();
    },
  });

  function resetSaleForm() {
    setCart([]);
    setSelectedPatient(null);
    setPatientQuery('');
    setWalkInName('');
    setWalkInPhone('');
    setNotes('');
    setDiscountAmount('0');
    setPaidAmount('');
    setPaymentMethod('cash');
  }

  function addToCart(m: Medicine) {
    setCart((prev) => {
      const existing = prev.find((c) => c.medicineId === m.id);
      if (existing) {
        if (existing.quantity >= m.stockQuantity) return prev;
        return prev.map((c) => (c.medicineId === m.id ? { ...c, quantity: c.quantity + 1 } : c));
      }
      if (m.stockQuantity <= 0) return prev;
      return [
        ...prev,
        {
          medicineId: m.id,
          name: m.name,
          genericName: m.genericName,
          unit: m.unit,
          sellPrice: Number(m.sellPrice),
          maxStock: m.stockQuantity,
          quantity: 1,
          batchNumber: m.batchNumber,
          expiryDate: m.expiryDate,
        },
      ];
    });
  }

  function updateQty(medicineId: string, qty: number) {
    setCart((prev) =>
      prev.map((c) => (c.medicineId === medicineId ? { ...c, quantity: Math.max(1, Math.min(qty, c.maxStock)) } : c)),
    );
  }

  function removeFromCart(medicineId: string) {
    setCart((prev) => prev.filter((c) => c.medicineId !== medicineId));
  }

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientQuery('');
    setWalkInName('');
    setWalkInPhone('');
  }

  function clearPatient() {
    setSelectedPatient(null);
    setPatientQuery('');
  }

  function focusMedicineSearch() {
    searchInputRef.current?.focus();
    searchInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function holdCurrentSale() {
    if (cart.length === 0) return;
    const held: HeldSale = {
      id: `held-${Date.now()}`,
      savedAt: new Date().toISOString(),
      cart,
      selectedPatient,
      walkInName,
      walkInPhone,
      discountAmount,
      notes,
    };
    const next = [held, ...heldSales];
    setHeldSales(next);
    saveHeldSales(next);
    resetSaleForm();
  }

  function resumeHeldSale(id: string) {
    const held = heldSales.find((h) => h.id === id);
    if (!held) return;
    setCart(held.cart);
    setSelectedPatient(held.selectedPatient);
    setWalkInName(held.walkInName);
    setWalkInPhone(held.walkInPhone);
    setDiscountAmount(held.discountAmount);
    setNotes(held.notes);
    const next = heldSales.filter((h) => h.id !== id);
    setHeldSales(next);
    saveHeldSales(next);
    setShowHeldSales(false);
  }

  function discardHeldSale(id: string) {
    const next = heldSales.filter((h) => h.id !== id);
    setHeldSales(next);
    saveHeldSales(next);
  }

  const subtotal = cart.reduce((sum, c) => sum + c.sellPrice * c.quantity, 0);
  const discount = Math.min(Number(discountAmount) || 0, subtotal);
  const taxable = subtotal - discount;
  const tax = Math.round(taxable * VAT_RATE * 100) / 100;
  const total = taxable + tax;
  const paid = paidAmount ? Number(paidAmount) : total;
  const change = Math.max(0, paid - total);

  const { lowStockCount, expiringSoonCount } = useMemo(() => {
    const list = medicines ?? [];
    const now = new Date();
    const soonCutoff = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
    let low = 0;
    let expiring = 0;
    for (const m of list) {
      if (m.stockQuantity <= (m.reorderLevel ?? 10)) low++;
      if (m.expiryDate) {
        const d = new Date(m.expiryDate);
        if (d >= now && d <= soonCutoff) expiring++;
      }
    }
    return { lowStockCount: low, expiringSoonCount: expiring };
  }, [medicines]);

  const { todaysSalesTotal, todaysSalesCount } = useMemo(() => {
    const list = allSales ?? [];
    const todayStr = new Date().toDateString();
    const todays = list.filter((s) => new Date(s.createdAt).toDateString() === todayStr);
    return {
      todaysSalesTotal: todays.reduce((sum, s) => sum + Number(s.totalAmount), 0),
      todaysSalesCount: todays.length,
    };
  }, [allSales]);

  const inputClass =
    'w-full px-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500';

  return (
    <div className="space-y-4">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .receipt-print-area, .receipt-print-area * { visibility: visible; }
          .receipt-print-area { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-bold text-clinical-900 flex items-center gap-2">
          <ShoppingCart size={22} className="text-primary-600" /> Point of Sale
        </h1>
        <p className="text-clinical-500 text-sm mt-1">Sell medicines directly over the counter.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-10 gap-4">
        {/* Medicine list */}
        <div className="xl:col-span-3 bg-white rounded-xl border border-clinical-200 p-4 space-y-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
            <input
              ref={searchInputRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search medicine, batch or generic name…"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize whitespace-nowrap ${
                  categoryFilter === c ? 'bg-primary-600 text-white' : 'bg-clinical-50 text-clinical-600 hover:bg-clinical-100'
                }`}
              >
                {c === 'all' ? 'All' : c}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-clinical-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : !medicines || medicines.length === 0 ? (
            <p className="text-center text-clinical-400 text-sm py-16">No medicines found</p>
          ) : (
            <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
              {medicines
                .filter((m) => categoryFilter === 'all' || m.category === categoryFilter)
                .map((m) => {
                  const isLow = m.stockQuantity <= (m.reorderLevel ?? 10);
                  return (
                    <button
                      key={m.id}
                      onClick={() => addToCart(m)}
                      disabled={m.stockQuantity <= 0}
                      className="w-full text-left bg-clinical-50 rounded-lg p-3 hover:bg-primary-50 hover:border-primary-200 border border-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex gap-3"
                    >
                      <span
                        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: TILE_COLORS[m.id.length % TILE_COLORS.length] }}
                      >
                        {(() => {
                          const Icon = getMedicineIcon(m.category);
                          return <Icon size={26} />;
                        })()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-clinical-900 text-sm">{m.name}</p>
                          <span className="text-sm font-bold text-primary-600 whitespace-nowrap">{fmt(Number(m.sellPrice))}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-xs ${isLow ? 'text-red-500 font-medium' : 'text-clinical-400'}`}>
                            Stock: {m.stockQuantity} {m.unit}(s)
                          </span>
                          {m.batchNumber && <span className="text-[11px] text-clinical-400">Batch {m.batchNumber}</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Patient info + current sale */}
        <div className="xl:col-span-4 space-y-4">
          <div className="bg-white rounded-xl border border-clinical-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-clinical-800 flex items-center gap-1.5">
                <User size={15} className="text-primary-600" /> Patient Information
              </h3>
              {(selectedPatient || walkInName) && (
                <button onClick={clearPatient} className="text-xs font-medium text-primary-600 hover:underline">
                  Change
                </button>
              )}
            </div>

            {selectedPatient ? (
              <div className="bg-clinical-50 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-clinical-900">{patientFullName(selectedPatient)}</p>
                  <p className="text-xs text-clinical-500">
                    {selectedPatient.patientNumber} {selectedPatient.phone ? `· ${selectedPatient.phone}` : ''}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-clinical-400" />
                  <input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search existing patient by name or phone…"
                    className="w-full pl-8 pr-3 py-2 text-sm border border-clinical-200 rounded-lg focus:outline-none focus:border-primary-500"
                  />
                  {isSearchingPatients && (
                    <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-clinical-300" />
                  )}
                </div>

                {patientQuery.trim().length >= 2 && (patientResults?.length ?? 0) > 0 && (
                  <div className="border border-clinical-200 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {patientResults!.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => selectPatient(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-clinical-50 border-b border-clinical-100 last:border-0"
                      >
                        <span className="font-medium text-clinical-900">{patientFullName(p)}</span>{' '}
                        <span className="text-clinical-400 text-xs">
                          {p.patientNumber} {p.phone ? `· ${p.phone}` : ''}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-clinical-400 text-center">— or enter walk-in details —</p>

                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={walkInName}
                    onChange={(e) => setWalkInName(e.target.value)}
                    placeholder="Walk-in name"
                    className={inputClass}
                  />
                  <input
                    value={walkInPhone}
                    onChange={(e) => setWalkInPhone(e.target.value)}
                    placeholder="Phone"
                    className={inputClass}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-clinical-200 p-4 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-clinical-800">Current Sale</h3>
              <button
                onClick={focusMedicineSearch}
                className="text-xs font-medium text-primary-600 hover:underline flex items-center gap-1"
              >
                <Plus size={12} /> Add More Medicine
              </button>
            </div>

            {cart.length === 0 ? (
              <p className="text-xs text-clinical-400 text-center py-10">Cart is empty — click a medicine to add it.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-clinical-400 border-b border-clinical-100">
                      <th className="text-left py-1.5 pr-2">Medicine</th>
                      <th className="text-left py-1.5 px-2">Batch</th>
                      <th className="text-left py-1.5 px-2">Expiry</th>
                      <th className="text-right py-1.5 px-2">Qty</th>
                      <th className="text-right py-1.5 px-2">Price</th>
                      <th className="text-right py-1.5 pl-2">Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {cart.map((c) => (
                      <tr key={c.medicineId} className="border-b border-clinical-50">
                        <td className="py-2 pr-2 font-medium text-clinical-900">{c.name}</td>
                        <td className="py-2 px-2 text-clinical-500">{c.batchNumber || '—'}</td>
                        <td className="py-2 px-2 text-clinical-500">
                          {c.expiryDate ? new Date(c.expiryDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <input
                            type="number"
                            min={1}
                            max={c.maxStock}
                            value={c.quantity}
                            onChange={(e) => updateQty(c.medicineId, Number(e.target.value))}
                            className="w-12 border border-clinical-200 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:border-primary-500"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">{fmt(c.sellPrice)}</td>
                        <td className="py-2 pl-2 text-right font-semibold">{fmt(c.sellPrice * c.quantity)}</td>
                        <td className="py-2 pl-1">
                          <button onClick={() => removeFromCart(c.medicineId)} className="text-clinical-300 hover:text-red-500">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-3">
              <label className="block text-[11px] text-clinical-500 mb-0.5">Notes (optional)</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add note…" className={inputClass} />
            </div>

            <div className="border-t border-clinical-100 pt-3 mt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] text-clinical-500 mb-0.5">Discount</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-clinical-500 mb-0.5">Amount Paid</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="text-sm space-y-1 py-1">
                <div className="flex justify-between text-clinical-500">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-clinical-500">
                  <span>Discount</span>
                  <span>-{fmt(discount)}</span>
                </div>
                <div className="flex justify-between text-clinical-500">
                  <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                  <span>{fmt(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-clinical-900 text-base pt-1 border-t border-clinical-100">
                  <span>Total</span>
                  <span>{fmt(total)}</span>
                </div>
              </div>

              {saleMutation.isError && (
                <p className="text-red-600 text-xs">
                  {(saleMutation.error as any)?.response?.data?.message ?? "Couldn't complete this sale."}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={holdCurrentSale}
                  disabled={cart.length === 0}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50 disabled:opacity-40 flex items-center justify-center gap-1.5"
                >
                  <Pause size={14} /> Hold Sale
                </button>
                <button
                  onClick={resetSaleForm}
                  disabled={cart.length === 0}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50 disabled:opacity-40"
                >
                  Clear
                </button>
              </div>
              <button
                onClick={() => saleMutation.mutate()}
                disabled={cart.length === 0 || saleMutation.isPending}
                className="w-full py-2.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saleMutation.isPending ? 'Processing…' : 'Complete Sale'}
              </button>
            </div>
          </div>
        </div>

        {/* Payment + quick actions */}
        <div className="xl:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-clinical-200 p-4">
            <h3 className="text-sm font-semibold text-clinical-800 mb-3">Payment Method</h3>
            <div className="space-y-1.5">
              {PAYMENT_METHODS.map((pm) => {
                const Icon = pm.icon;
                const active = paymentMethod === pm.value;
                return (
                  <label
                    key={pm.value}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      active ? 'border-primary-300 bg-primary-50' : 'border-clinical-200 hover:bg-clinical-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="paymentMethod"
                      value={pm.value}
                      checked={active}
                      onChange={() => setPaymentMethod(pm.value)}
                      className="accent-primary-600"
                    />
                    <span className={`w-7 h-7 rounded-md flex items-center justify-center ${pm.tint}`}>
                      <Icon size={14} />
                    </span>
                    <span className="text-sm font-medium text-clinical-800">{pm.label}</span>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-clinical-100 space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-clinical-500">Amount Paid</span>
                <span className="font-medium">{fmt(paid)}</span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-green-700">
                <span>Change</span>
                <span>{fmt(change)}</span>
              </div>
              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-clinical-500">Status</span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold text-white ${
                    paid >= total && total > 0 ? 'bg-green-600' : 'bg-amber-500'
                  }`}
                >
                  {total === 0 ? '—' : paid >= total ? 'PAID' : 'PARTIAL'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-clinical-200 p-4">
            <h3 className="text-sm font-semibold text-clinical-800 mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={resetSaleForm}
                className="flex flex-col items-center gap-1 py-3 rounded-lg bg-clinical-50 hover:bg-clinical-100 text-clinical-700"
              >
                <Plus size={17} />
                <span className="text-[11px] font-medium">New Sale</span>
              </button>
              <button
                onClick={focusMedicineSearch}
                className="flex flex-col items-center gap-1 py-3 rounded-lg bg-clinical-50 hover:bg-clinical-100 text-clinical-700"
              >
                <Users size={17} />
                <span className="text-[11px] font-medium">Search Patient</span>
              </button>
              <button
                onClick={() => setShowHeldSales(true)}
                className="relative flex flex-col items-center gap-1 py-3 rounded-lg bg-clinical-50 hover:bg-clinical-100 text-clinical-700"
              >
                <Pause size={17} />
                <span className="text-[11px] font-medium">Held Sales</span>
                {heldSales.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 bg-primary-600 text-white text-[10px] leading-none rounded-full w-4 h-4 flex items-center justify-center">
                    {heldSales.length}
                  </span>
                )}
              </button>
              {/* NOTE: adjust these hrefs if your router uses different paths */}
              <a
                href="/pharmacy/returns"
                className="flex flex-col items-center gap-1 py-3 rounded-lg bg-clinical-50 hover:bg-clinical-100 text-clinical-700"
              >
                <RotateCcw size={17} />
                <span className="text-[11px] font-medium">Returns</span>
              </a>
              <a
                href="/pharmacy/sales"
                className="flex flex-col items-center gap-1 py-3 rounded-lg bg-clinical-50 hover:bg-clinical-100 text-clinical-700"
              >
                <ClipboardList size={17} />
                <span className="text-[11px] font-medium">Sales History</span>
              </a>
              <button
                onClick={() => receipt && window.print()}
                disabled={!receipt}
                className="flex flex-col items-center gap-1 py-3 rounded-lg bg-clinical-50 hover:bg-clinical-100 text-clinical-700 disabled:opacity-40"
              >
                <Printer size={17} />
                <span className="text-[11px] font-medium">Print Receipt</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stock / expiry / sales alert bar */}
      <div className="bg-white rounded-xl border border-clinical-200 p-4 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} className={lowStockCount > 0 ? 'text-red-500' : 'text-clinical-300'} />
          <div>
            <p className="text-xs text-clinical-500">Current Stock Alert</p>
            <p className={`text-sm font-semibold ${lowStockCount > 0 ? 'text-red-600' : 'text-clinical-800'}`}>
              {lowStockCount} item{lowStockCount === 1 ? '' : 's'} low stock
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <CalendarClock size={16} className={expiringSoonCount > 0 ? 'text-amber-500' : 'text-clinical-300'} />
          <div>
            <p className="text-xs text-clinical-500">Expiring Soon</p>
            <p className="text-sm font-semibold text-clinical-800">
              {expiringSoonCount} item{expiringSoonCount === 1 ? '' : 's'} (next {EXPIRING_SOON_DAYS} days)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-green-500" />
          <div>
            <p className="text-xs text-clinical-500">Today's Sales</p>
            <p className="text-sm font-semibold text-clinical-800">
              {fmt(todaysSalesTotal)} · {todaysSalesCount} transaction{todaysSalesCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <a
          href="/pharmacy/reports"
          className="ml-auto flex items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
        >
          View Reports <ChevronRight size={14} />
        </a>
      </div>

      {/* ---------- Held Sales Modal ---------- */}
      {showHeldSales && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowHeldSales(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-clinical-100">
              <h3 className="text-sm font-semibold text-clinical-800">Held Sales</h3>
              <button onClick={() => setShowHeldSales(false)} className="text-clinical-400 hover:text-clinical-600">
                <X size={16} />
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {heldSales.length === 0 ? (
                <p className="text-center text-clinical-400 text-sm py-10">No held sales.</p>
              ) : (
                heldSales.map((h) => {
                  const heldTotal = h.cart.reduce((sum, c) => sum + c.sellPrice * c.quantity, 0);
                  const who = h.selectedPatient ? patientFullName(h.selectedPatient) : h.walkInName || 'Walk-in';
                  return (
                    <div key={h.id} className="flex items-center justify-between px-5 py-3 border-b border-clinical-50 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-clinical-900">{who}</p>
                        <p className="text-xs text-clinical-400">
                          {h.cart.length} item{h.cart.length === 1 ? '' : 's'} · {fmt(heldTotal)} ·{' '}
                          {new Date(h.savedAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => resumeHeldSale(h.id)}
                          className="text-xs font-medium text-primary-600 hover:underline"
                        >
                          Resume
                        </button>
                        <button
                          onClick={() => discardHeldSale(h.id)}
                          className="text-clinical-300 hover:text-red-500"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Receipt Modal ---------- */}
      {receipt && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setReceipt(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="receipt-print-area p-6">
              <div className="flex items-start justify-between border-b-2 border-red-600 pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-red-600 text-white flex items-center justify-center flex-shrink-0">
                    <ShoppingBag size={22} />
                  </div>
                  <div>
                    <p className="text-lg font-extrabold text-red-600 leading-tight">{PHARMACY_INFO.name}</p>
                    <p className="text-[11px] text-clinical-400">{PHARMACY_INFO.tagline}</p>
                  </div>
                </div>
                <div className="text-right text-[11px] text-clinical-500 leading-relaxed">
                  <p>{PHARMACY_INFO.addressLine1}</p>
                  <p>{PHARMACY_INFO.addressLine2}</p>
                  <p>{PHARMACY_INFO.phone}</p>
                </div>
              </div>

              <h2 className="text-center text-lg font-bold text-clinical-900 mb-4">SALES RECEIPT</h2>

              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-clinical-400">Invoice No</span>
                  <span className="font-semibold text-red-600">{receipt.saleNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinical-400">Customer</span>
                  <span className="font-medium">{receipt.customerName || 'Walk-in Customer'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinical-400">Date</span>
                  <span>{new Date(receipt.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinical-400">Phone</span>
                  <span>{receipt.customerPhone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-clinical-400">Time</span>
                  <span>{new Date(receipt.createdAt).toLocaleTimeString('en-US', { timeStyle: 'short' })}</span>
                </div>
                {receipt.notes && (
                  <div className="flex justify-between col-span-2">
                    <span className="text-clinical-400">Note</span>
                    <span>{receipt.notes}</span>
                  </div>
                )}
              </div>

              <table className="w-full text-xs mb-4">
                <thead>
                  <tr className="bg-red-600 text-white">
                    <th className="text-left py-1.5 px-2 rounded-l">#</th>
                    <th className="text-left py-1.5 px-2">Medicine</th>
                    <th className="text-right py-1.5 px-2">Qty</th>
                    <th className="text-right py-1.5 px-2">Price</th>
                    <th className="text-right py-1.5 px-2 rounded-r">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.items.map((it: any, i: number) => (
                    <tr key={it.id} className="border-b border-clinical-50">
                      <td className="py-1.5 px-2">{i + 1}</td>
                      <td className="py-1.5 px-2">{it.medicine.name}</td>
                      <td className="py-1.5 px-2 text-right">{it.quantity}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(Number(it.unitPrice))}</td>
                      <td className="py-1.5 px-2 text-right">{fmt(Number(it.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-52 text-sm space-y-1">
                  <div className="flex justify-between text-clinical-500">
                    <span>Subtotal</span>
                    <span>{fmt(Number(receipt.subtotalAmount))}</span>
                  </div>
                  <div className="flex justify-between text-clinical-500">
                    <span>Discount</span>
                    <span>{fmt(Number(receipt.discountAmount))}</span>
                  </div>
                  <div className="flex justify-between text-clinical-500">
                    <span>VAT ({(VAT_RATE * 100).toFixed(0)}%)</span>
                    <span>{fmt(Number(receipt.taxAmount))}</span>
                  </div>
                  <div className="flex justify-between font-bold text-clinical-900 pt-1 border-t border-clinical-100">
                    <span>TOTAL</span>
                    <span className="text-red-600">{fmt(Number(receipt.totalAmount))}</span>
                  </div>
                  <div className="flex justify-between text-clinical-500">
                    <span>Paid</span>
                    <span>{fmt(Number(receipt.paidAmount))}</span>
                  </div>
                  <div className="flex justify-between font-semibold bg-red-50 text-red-600 px-2 py-1 rounded">
                    <span>Change</span>
                    <span>{fmt(Number(receipt.changeAmount))}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-clinical-100 flex items-center justify-between text-xs">
                <span className="px-2 py-1 rounded bg-red-600 text-white font-semibold capitalize">
                  {PAYMENT_METHODS.find((p) => p.value === receipt.paymentMethod)?.label ?? receipt.paymentMethod}
                </span>
                <span className="text-clinical-400">Thank you for choosing {PHARMACY_INFO.name}!</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-clinical-100 print:hidden">
              <button
                onClick={() => setReceipt(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-clinical-200 text-clinical-600 hover:bg-clinical-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-primary-600 text-white hover:opacity-90"
              >
                <Printer size={15} /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
