"""
Run this on your machine:
    python3 group_invoice_charges.py

It rewrites CreateInvoicePage.tsx so that loading Lab/Pharmacy/Appointment
charges produces ONE line item per category (instead of one line per test
or medicine), with a small chevron to expand/collapse and see the
breakdown underneath. Manual "Add Item" lines are unaffected.
"""
import pathlib
import sys

PATH = pathlib.Path(
    "/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/billing/CreateInvoicePage.tsx"
)

text = PATH.read_text()
original = text

# ---------------------------------------------------------------------------
# 1. Extend LineItem to support a collapsible breakdown
# ---------------------------------------------------------------------------
old_interface = """interface LineItem {
  id: string;
  description: string;
  qty: number;
  unitPrice: number;
  auto?: boolean;
}"""

new_interface = """interface LineItemChild {
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

if old_interface not in text:
    print("STEP 1 PATTERN NOT FOUND — aborting before making changes.")
    sys.exit(1)
text = text.replace(old_interface, new_interface, 1)

# ---------------------------------------------------------------------------
# 2. Import ChevronDown/ChevronRight icons
# ---------------------------------------------------------------------------
old_icons = "import { Plus, Trash2, Download, Loader2 } from 'lucide-react';"
new_icons = "import { Plus, Trash2, Download, Loader2, ChevronDown, ChevronRight } from 'lucide-react';"
if old_icons not in text:
    print("STEP 2 PATTERN NOT FOUND — aborting.")
    sys.exit(1)
text = text.replace(old_icons, new_icons, 1)

# ---------------------------------------------------------------------------
# 3. Replace the flat per-test/per-medicine push logic with one grouped line
#    per category (Lab, Pharmacy). Appointment stays a single line as before.
# ---------------------------------------------------------------------------
old_onsuccess_body = """      const { appointmentFee, labItems, pharmacyItems } = res.data;
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
        (labItems ?? []).forEach((t: { name: string; price: number }) => {
          additions.push({
            id: crypto.randomUUID(),
            description: `Lab: ${t.name}`,
            qty: 1,
            unitPrice: t.price,
            auto: true,
          });
        });
        (pharmacyItems ?? []).forEach((m: { name: string; qty: number; unitPrice: number }) => {
          additions.push({
            id: crypto.randomUUID(),
            description: `Medicine: ${m.name}`,
            qty: m.qty,
            unitPrice: m.unitPrice,
            auto: true,
          });
        });
        return [...manualItems, ...additions, emptyItem()];
      });"""

new_onsuccess_body = """      const { appointmentFee, labItems, pharmacyItems } = res.data;
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
      });"""

if old_onsuccess_body not in text:
    print("STEP 3 PATTERN NOT FOUND — aborting.")
    sys.exit(1)
text = text.replace(old_onsuccess_body, new_onsuccess_body, 1)

# ---------------------------------------------------------------------------
# 4. Add a toggle helper for expand/collapse
# ---------------------------------------------------------------------------
old_remove_item = """  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };"""

new_remove_item = """  const removeItem = (id: string) => {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  };

  const toggleExpanded = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, expanded: !i.expanded } : i)));
  };"""

if old_remove_item not in text:
    print("STEP 4 PATTERN NOT FOUND — aborting.")
    sys.exit(1)
text = text.replace(old_remove_item, new_remove_item, 1)

# ---------------------------------------------------------------------------
# 5. Render: add a chevron before the description input (only when the item
#    has children) and a breakdown block underneath when expanded.
# ---------------------------------------------------------------------------
old_row_open = """            {items.map((item) => (
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

new_row_open = """            {items.map((item) => (
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

if old_row_open not in text:
    print("STEP 5a PATTERN NOT FOUND — aborting.")
    sys.exit(1)
text = text.replace(old_row_open, new_row_open, 1)

old_row_close = """                <div className="col-span-1 pb-2">
                  <button onClick={() => removeItem(item.id)} className="text-gray-400 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}"""

new_row_close = """                <div className="col-span-1 pb-2">
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

if old_row_close not in text:
    print("STEP 5b PATTERN NOT FOUND — aborting.")
    sys.exit(1)
text = text.replace(old_row_close, new_row_close, 1)

if text == original:
    print("NO CHANGES MADE — something matched nothing effectively; check the file manually.")
    sys.exit(1)

PATH.write_text(text)
print("SUCCESS — CreateInvoicePage.tsx updated.")
print("Restart the frontend dev server if it doesn't hot-reload cleanly.")
