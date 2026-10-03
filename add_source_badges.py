"""
Run this on your machine:
    python3 add_source_badges.py

Adds a "Source" column to BOTH invoice tables (the patient's Invoices tab
and the main Billing > Invoices page), showing small colored badges
(Lab / Pharmacy / Appointment / Other) derived from each invoice's line
item descriptions ("Lab: ...", "Medicine: ...", "Appointment / ...").
"""
import pathlib
import sys

PATIENT_PAGE = pathlib.Path(
    "/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx"
)
INVOICES_PAGE = pathlib.Path(
    "/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/billing/InvoicesPage.tsx"
)


def require(text, old, step, path):
    if old not in text:
        print(f"{step} PATTERN NOT FOUND in {path.name} — aborting. Paste back current content of that section.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# PART A — InvoicesPage.tsx
# ---------------------------------------------------------------------------
a_text = INVOICES_PAGE.read_text()
a_original = a_text

# A1: add a source-badge helper right after the `money` helper.
old_money = """function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}"""

new_money = """function money(n: number) {
  return `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

type SourceKey = 'lab' | 'pharmacy' | 'appointment' | 'other';

const SOURCE_STYLES: Record<SourceKey, string> = {
  lab: 'bg-blue-100 text-blue-700',
  pharmacy: 'bg-green-100 text-green-700',
  appointment: 'bg-purple-100 text-purple-700',
  other: 'bg-gray-100 text-gray-600',
};

const SOURCE_LABELS: Record<SourceKey, string> = {
  lab: 'Lab',
  pharmacy: 'Pharmacy',
  appointment: 'Appointment',
  other: 'Other',
};

function categoryOfDescription(description: string): SourceKey {
  const d = (description || '').toLowerCase();
  if (d.startsWith('lab:')) return 'lab';
  if (d.startsWith('medicine:')) return 'pharmacy';
  if (d.startsWith('appointment')) return 'appointment';
  return 'other';
}

export function InvoiceSourceBadges({ items }: { items?: { description: string }[] }) {
  const keys = Array.from(new Set((items ?? []).map((i) => categoryOfDescription(i.description))));
  if (keys.length === 0) return <span className="text-xs text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((k) => (
        <span key={k} className={`rounded-full px-2 py-0.5 text-xs font-medium ${SOURCE_STYLES[k]}`}>
          {SOURCE_LABELS[k]}
        </span>
      ))}
    </div>
  );
}"""

require(a_text, old_money, "A1", INVOICES_PAGE)
a_text = a_text.replace(old_money, new_money, 1)

# A2: table header — insert Source th before Status th
old_header = """                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Status</th>"""
new_header = """                <th className="px-4 py-2 font-medium">Due</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Status</th>"""
require(a_text, old_header, "A2", INVOICES_PAGE)
a_text = a_text.replace(old_header, new_header, 1)

# A3: table row — insert Source td before Status td
old_row = """                  <td className="px-4 py-2 text-red-600">
                    {money(Number(inv.total) - Number(inv.paid))}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={inv.status} />
                  </td>"""
new_row = """                  <td className="px-4 py-2 text-red-600">
                    {money(Number(inv.total) - Number(inv.paid))}
                  </td>
                  <td className="px-4 py-2">
                    <InvoiceSourceBadges items={inv.items} />
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={inv.status} />
                  </td>"""
require(a_text, old_row, "A3", INVOICES_PAGE)
a_text = a_text.replace(old_row, new_row, 1)

if a_text != a_original:
    INVOICES_PAGE.write_text(a_text)
    print(f"SUCCESS — {INVOICES_PAGE.name} updated with Source column.")

# ---------------------------------------------------------------------------
# PART B — PatientDetailPage.tsx
# ---------------------------------------------------------------------------
b_text = PATIENT_PAGE.read_text()
b_original = b_text

# B1: import the shared badge component + helper from InvoicesPage
old_import = "import { InvoiceModal } from '../billing/InvoicesPage';"
new_import = "import { InvoiceModal, InvoiceSourceBadges } from '../billing/InvoicesPage';"
require(b_text, old_import, "B1", PATIENT_PAGE)
b_text = b_text.replace(old_import, new_import, 1)

# B2: table header — insert Source th before Status th
old_header = """                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>"""
new_header = """                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Source</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>"""
require(b_text, old_header, "B2", PATIENT_PAGE)
b_text = b_text.replace(old_header, new_header, 1)

# B3: table row — insert Source td before Status td
old_row = """                      <td className="py-3 pr-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{statusPill(inv.status)}</td>"""
new_row = """                      <td className="py-3 pr-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">
                        <InvoiceSourceBadges items={inv.items} />
                      </td>
                      <td className="py-3 pr-4">{statusPill(inv.status)}</td>"""
require(b_text, old_row, "B3", PATIENT_PAGE)
b_text = b_text.replace(old_row, new_row, 1)

if b_text == b_original:
    print("NO CHANGES MADE to PatientDetailPage.tsx.")
    sys.exit(1)

PATIENT_PAGE.write_text(b_text)
print(f"SUCCESS — {PATIENT_PAGE.name} updated with Source column.")
print("Restart the frontend dev server if it doesn't hot-reload cleanly.")
