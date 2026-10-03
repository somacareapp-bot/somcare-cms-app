#!/usr/bin/env bash
set -euo pipefail

FILE="frontend/src/components/layout/Sidebar.tsx"

if [ ! -f "$FILE" ]; then
  echo "ERROR: $FILE not found. Run this from your project root (Clinical MS/cms)."
  exit 1
fi

cp "$FILE" "$FILE.bak.$(date +%Y%m%d%H%M%S)"
echo "Backed up $FILE"

python3 - "$FILE" <<'PYEOF'
import sys

path = sys.argv[1]
with open(path, "r") as f:
    content = f.read()

# 1. Remove the standalone "Lab" group I previously added under Clinical
#    (its Supplies / Purchase Supplies pages move into Inventory instead)
old_lab_group = """      {
        label: 'Lab',
        path: '/lab',
        icon: FlaskConical,
        permission: 'inventory:read',
        children: [
          { label: 'Supplies',          path: '/inventory/lab-supplies',           icon: FlaskConical, permission: 'inventory:read' },
          { label: 'Purchase Supplies', path: '/inventory/lab-supplies/purchases', icon: Banknote,     permission: 'inventory:update' },
        ],
      },
"""

if old_lab_group not in content:
    print("ERROR: could not find the standalone Lab group to remove. Aborting — no changes made.")
    sys.exit(1)

content = content.replace(old_lab_group, "")

# 2. Trim Medicines / Purchases out of the Clinical Pharmacy menu
#    (they move into Inventory > Pharmacy instead)
old_pharmacy_children = """        children: [
          { label: 'Dashboard',     path: '/pharmacy',               icon: LayoutDashboard, permission: 'pharmacy:read' },
          { label: 'Prescriptions', path: '/pharmacy/prescriptions', icon: ClipboardList,   permission: 'pharmacy:read' },
          { label: 'Dispensing',    path: '/pharmacy/dispensing',    icon: Package,         permission: 'pharmacy:read' },
          { label: 'Medicines',     path: '/pharmacy/medicines',     icon: Pill,            permission: 'pharmacy:read' },
          { label: 'Low Stock',     path: '/pharmacy/low-stock',     icon: AlertCircle,     permission: 'pharmacy:read' },
          { label: 'Purchases',     path: '/pharmacy/purchases',     icon: Banknote,        permission: 'pharmacy:read' },
          { label: 'POS',           path: '/pharmacy/pos',           icon: ShoppingCart,    permission: 'pharmacy:read' },
        ],"""

new_pharmacy_children = """        children: [
          { label: 'Dashboard',     path: '/pharmacy',               icon: LayoutDashboard, permission: 'pharmacy:read' },
          { label: 'Prescriptions', path: '/pharmacy/prescriptions', icon: ClipboardList,   permission: 'pharmacy:read' },
          { label: 'Dispensing',    path: '/pharmacy/dispensing',    icon: Package,         permission: 'pharmacy:read' },
          { label: 'Low Stock',     path: '/pharmacy/low-stock',     icon: AlertCircle,     permission: 'pharmacy:read' },
          { label: 'POS',           path: '/pharmacy/pos',           icon: ShoppingCart,    permission: 'pharmacy:read' },
        ],"""

if old_pharmacy_children not in content:
    print("ERROR: could not find the Clinical Pharmacy children block. Aborting — no changes made.")
    sys.exit(1)

content = content.replace(old_pharmacy_children, new_pharmacy_children)

# 3. Add a consolidated "Inventory" group under Finance, nesting Lab and Pharmacy
anchor = """    ],
  },
  {
    section: 'Operations',"""

new_inventory_block = """      {
        label: 'Inventory',
        path: '/inventory',
        icon: Package,
        permission: 'inventory:read',
        children: [
          {
            label: 'Lab',
            path: '/inventory/lab',
            icon: FlaskConical,
            permission: 'inventory:read',
            children: [
              { label: 'Supplies',          path: '/inventory/lab-supplies',           icon: FlaskConical, permission: 'inventory:read' },
              { label: 'Purchase Supplies', path: '/inventory/lab-supplies/purchases', icon: Banknote,     permission: 'inventory:update' },
            ],
          },
          {
            label: 'Pharmacy',
            path: '/inventory/pharmacy',
            icon: Pill,
            permission: 'inventory:read',
            children: [
              { label: 'Medicines', path: '/pharmacy/medicines', icon: Pill,     permission: 'pharmacy:read' },
              { label: 'Purchase',  path: '/pharmacy/purchases', icon: Banknote, permission: 'pharmacy:read' },
            ],
          },
        ],
      },
"""

if anchor not in content:
    print("ERROR: could not find the Finance/Operations section boundary. Aborting — no changes made.")
    sys.exit(1)

content = content.replace(anchor, new_inventory_block + anchor)

with open(path, "w") as f:
    f.write(content)

print("Patched:", path)
PYEOF

echo "Done. Diff below:"
echo "---------------------------------------------"
git diff -- "$FILE" || true
