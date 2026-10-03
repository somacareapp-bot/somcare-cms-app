"""
Run this on your machine:
    python3 dropdown_load_charges.py

This REPLACES the previous chevron/expand-breakdown behavior with what you
actually asked for: the "Load Lab & Pharmacy Charges" button becomes a
dropdown with options:
    - Load Appointment Fee
    - Load Lab Charges
    - Load Pharmacy Charges
    - Load All

Picking one only loads/replaces that category's line item(s); the others
are left alone. Re-picking a category replaces just that category's
previous auto line (no duplicates), keeping the rest intact.
"""
import pathlib
import sys

PATH = pathlib.Path(
    "/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/billing/CreateInvoicePage.tsx"
)

text = PATH.read_text()
original = text

def require(old, step):
    if old not in text:
        print(f"{step} PATTERN NOT FOUND — aborting. Paste back the current file content of that section.")
        sys.exit(1)

# ---------------------------------------------------------------------------
# 1. LineItem: drop children/expanded (previous approach), add `category`
#    so we know which auto-line belongs to which source when replacing it.
# ---------------------------------------------------------------------------
old_interface = """interface LineItemChild {
  name: string;
  price: number;
}

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  auto?: boolean;
  children?: LineItemChild[];
  expanded?: boolean;
}"""

new_interface = """type ChargeCategory = 'appointment' | 'lab' | 'pharmacy';

interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  auto?: boolean;
  category?: ChargeCategory;
}"""

require(old_interface, "STEP 1")
text = text.replace(old_interface, new_interface, 1)

# ---------------------------------------------------------------------------
# 2. Icons: drop ChevronDown/ChevronRight (no longer needed), keep others,
#    add ChevronDown back only for the dropdown trigger itself.
# ---------------------------------------------------------------------------
old_icons = "import { Plus, Trash2, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react';"
new_icons = "import { Plus, Trash2, Download, Loader2, ChevronDown } from 'lucide-react';"
require(old_icons, "STEP 2")
text = text.replace(old_icons, new_icons, 1)

# ---------------------------------------------------------------------------
# 3. Add dropdown-open state near the other useState calls.
# ---------------------------------------------------------------------------
old_state = """  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);"""

new_state = """  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [loadMenuOpen, setLoadMenuOpen] = useState(false);"""

require(old_state, "STEP 3")
text = text.replace(old_state, new_state, 1)

# ---------------------------------------------------------------------------
# 4. Replace the mutation + effect: loadChargesMutation now takes a target
#    category ('appointment' | 'lab' | 'pharmacy' | 'all') and only adds/
#    replaces lines for that category.
# ---------------------------------------------------------------------------
old_block = """  const loadChargesMutation = useMutation({
    mutationFn: () => billingApi.getVisitSummary(visitId),
    onSuccess: (res) => {
      const { appointmentFee, labItems, pharmacyItems } = res.data;
      setItems((prev) => {
        // Drop any previously auto-loaded charge lines so re-running this (auto or manual)
        // replaces them instead of stacking duplicates. Keep manual lines and drop blanks.
        const manualItems = prev.filter((i) => !i.auto && i.description.trim() !== '');
        const additions: LineItem[] = [];

        if (appointmentFee > 0) {
          additions.push({
            id: crypto.randomUUID(),
            description: 'Appointment / Consultation Fee',
            qty: 1,
            unitPrice: appointmentFee,
            auto: true,
          });
        }

        // One consolidated, expandable line for all lab charges on this visit,
        // instead of a separate line per individual test.
        const labList = (labItems ?? []) as { name: string; price: number }[];
        if (labList.length > 0) {
          const labTotal = labList.reduce((sum, t) => sum + t.price, 0);
          additions.push({
            id: crypto.randomUUID(),
            description: `Lab Charges (${labList.length} test${labList.length > 1 ? 's' : ''})`,
            qty: 1,
            unitPrice: Math.round(labTotal * 100) / 100,
            auto: true,
            children: labList.map((t) => ({ name: t.name, price: t.price })),
          });
        }

        // One consolidated, expandable line for all dispensed medicines on this visit,
        // instead of a separate line per medicine.
        const pharmacyList = (pharmacyItems ?? []) as { name: string; qty: number; unitPrice: number }[];
        if (pharmacyList.length > 0) {
          const pharmacyTotal = pharmacyList.reduce((sum, m) => sum + m.qty * m.unitPrice, 0);
          additions.push({
            id: crypto.randomUUID(),
            description: `Pharmacy Charges (${pharmacyList.length} item${pharmacyList.length > 1 ? 's' : ''})`,
            qty: 1,
            unitPrice: Math.round(pharmacyTotal * 100) / 100,
            auto: true,
            children: pharmacyList.map((m) => ({
              name: `${m.name} x${m.qty}`,
              price: Math.round(m.qty * m.unitPrice * 100) / 100,
            })),
          });
        }

        return [...manualItems, ...additions, emptyItem()];
      });
    },
  });

  // Auto-load Lab/Pharmacy/Appointment charges the moment this page opens for a visit,
  // so reception doesn't have to remember to click "Load Charges" manually.
  useEffect(() => {
    if (visitId) {
      loadChargesMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);"""

new_block = """  const loadChargesMutation = useMutation({
    mutationFn: (target: ChargeCategory | 'all') =>
      billingApi.getVisitSummary(visitId).then((res) => ({ target, data: res.data })),
    onSuccess: ({ target, data }) => {
      const { appointmentFee, labItems, pharmacyItems } = data;
      const wanted: ChargeCategory[] =
        target === 'all' ? ['appointment', 'lab', 'pharmacy'] : [target];

      setItems((prev) => {
        // Keep manual lines, and keep auto lines for categories we're NOT
        // (re)loading right now — only the selected category's previous
        // auto line(s) get replaced, so picking "Load Lab" again doesn't
        // touch an already-loaded Pharmacy line.
        const kept = prev.filter(
          (i) => (!i.auto && i.description.trim() !== '') || (i.auto && i.category && !wanted.includes(i.category))
        );

        const additions: LineItem[] = [];

        if (wanted.includes('appointment') && appointmentFee > 0) {
          additions.push({
            id: crypto.randomUUID(),
            description: 'Appointment / Consultation Fee',
            qty: 1,
            unitPrice: appointmentFee,
            auto: true,
            category: 'appointment',
          });
        }

        if (wanted.includes('lab')) {
          (labItems ?? []).forEach((t: { name: string; price: number }) => {
            additions.push({
              id: crypto.randomUUID(),
              description: `Lab: ${t.name}`,
              qty: 1,
              unitPrice: t.price,
              auto: true,
              category: 'lab',
            });
          });
        }

        if (wanted.includes('pharmacy')) {
          (pharmacyItems ?? []).forEach((m: { name: string; qty: number; unitPrice: number }) => {
            additions.push({
              id: crypto.randomUUID(),
              description: `Medicine: ${m.name}`,
              qty: m.qty,
              unitPrice: m.unitPrice,
              auto: true,
              category: 'pharmacy',
            });
          });
        }

        return [...kept, ...additions, emptyItem()];
      });
    },
  });

  const loadCategory = (target: ChargeCategory | 'all') => {
    setLoadMenuOpen(false);
    loadChargesMutation.mutate(target);
  };"""

require(old_block, "STEP 4")
text = text.replace(old_block, new_block, 1)

# ---------------------------------------------------------------------------
# 5. Swap the single "Load Lab & Pharmacy Charges" button for a dropdown
#    trigger + menu with the four options.
# ---------------------------------------------------------------------------
old_button = """              {visitId && (
                <button
                  onClick={() => loadChargesMutation.mutate()}
                  disabled={loadChargesMutation.isPending}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {loadChargesMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  Load Lab & Pharmacy Charges
                </button>
              )}"""

new_button = """              {visitId && (
                <div className="relative">
                  <button
                    onClick={() => setLoadMenuOpen((o) => !o)}
                    disabled={loadChargesMutation.isPending}
                    className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                  >
                    {loadChargesMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    Load Charges
                    <ChevronDown size={14} />
                  </button>
                  {loadMenuOpen && (
                    <>
                      {/* Click-away backdrop */}
                      <div className="fixed inset-0 z-10" onClick={() => setLoadMenuOpen(false)} />
                      <div className="absolute right-0 top-full z-20 mt-1 w-56 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                        <button
                          onClick={() => loadCategory('appointment')}
                          className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Load Appointment Fee
                        </button>
                        <button
                          onClick={() => loadCategory('lab')}
                          className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Load Lab Charges
                        </button>
                        <button
                          onClick={() => loadCategory('pharmacy')}
                          className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                        >
                          Load Pharmacy Charges
                        </button>
                        <div className="my-1 border-t border-gray-100" />
                        <button
                          onClick={() => loadCategory('all')}
                          className="block w-full px-3 py-2 text-left text-xs font-medium text-blue-700 hover:bg-blue-50"
                        >
                          Load All
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}"""

require(old_button, "STEP 5")
text = text.replace(old_button, new_button, 1)

# ---------------------------------------------------------------------------
# 6. Undo the previous chevron/expand row markup, back to the plain row.
# ---------------------------------------------------------------------------
old_row_open = """            {items.map((item) => (
              <div key={item.id}>
              <div className="grid grid-cols-12 items-end gap-3">
                <div className="col-span-6">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                  <div className="flex items-center gap-1.5">
                    {item.children && item.children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(item.id)}
                        className="shrink-0 text-gray-400 hover:text-gray-600"
                        aria-label={item.expanded ? 'Collapse breakdown' : 'Expand breakdown'}
                      >
                        {item.expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </button>
                    )}
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, { description: e.target.value })}
                      placeholder="Service description"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>"""

new_row_open = """            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 items-end gap-3">
                <div className="col-span-6">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(item.id, { description: e.target.value })}
                    placeholder="Service description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>"""

require(old_row_open, "STEP 6a")
text = text.replace(old_row_open, new_row_open, 1)

old_row_close = """                <div className="col-span-1 pb-2">
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              {item.expanded && item.children && item.children.length > 0 && (
                <div className="ml-6 mt-1.5 mb-1 space-y-1 border-l-2 border-gray-100 pl-3">
                  {item.children.map((child, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs text-gray-500">
                      <span>{child.name}</span>
                      <span>${child.price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
              </div>
            ))}"""

new_row_close = """                <div className="col-span-1 pb-2">
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}"""

require(old_row_close, "STEP 6b")
text = text.replace(old_row_close, new_row_close, 1)

# ---------------------------------------------------------------------------
# 7. Remove the toggleExpanded helper (no longer used).
# ---------------------------------------------------------------------------
old_toggle = """
  const toggleExpanded = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, expanded: !i.expanded } : i)));
  };"""
if old_toggle in text:
    text = text.replace(old_toggle, "", 1)

# ---------------------------------------------------------------------------
# 8. The auto-load-on-open effect now needs to call loadChargesMutation with
#    an argument ('all') since mutationFn requires one.
# ---------------------------------------------------------------------------
old_effect = """  // Auto-load Lab/Pharmacy/Appointment charges the moment this page opens for a visit,
  // so reception doesn't have to remember to click "Load Charges" manually.
  useEffect(() => {
    if (visitId) {
      loadChargesMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);"""

# Note: step 4's new_block already ends right before where this effect used to be,
# and step 4's old_block INCLUDED this effect, replaced wholesale. Nothing to do here
# unless the effect still exists separately (defensive check):
if old_effect in text:
    new_effect = """  // Auto-load Lab/Pharmacy/Appointment charges the moment this page opens for a visit,
  // so reception doesn't have to remember to click "Load Charges" manually.
  useEffect(() => {
    if (visitId) {
      loadChargesMutation.mutate('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);"""
    text = text.replace(old_effect, new_effect, 1)

if text == original:
    print("NO CHANGES MADE.")
    sys.exit(1)

PATH.write_text(text)
print("SUCCESS — CreateInvoicePage.tsx updated with dropdown category loader.")
print("Restart the frontend dev server if it doesn't hot-reload cleanly.")
