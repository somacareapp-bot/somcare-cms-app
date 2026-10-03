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

# 1. Remove the "Inventory" nav item (now empty — its two children move to the new Lab group)
old_inventory = """      {
        label: 'Inventory',
        path: '/inventory',
        icon: Package,
        permission: 'inventory:read',
        children: [
          { label: 'Laboratory Supplies', path: '/inventory/lab-supplies',           icon: FlaskConical, permission: 'inventory:read' },
          { label: 'Supplies Purchase',   path: '/inventory/lab-supplies/purchases', icon: Banknote,     permission: 'inventory:update' },
        ],
      },
"""

if old_inventory not in content:
    print("ERROR: could not find the Inventory nav block to remove. Aborting — no changes made.")
    sys.exit(1)

content = content.replace(old_inventory, "")

# 2. Insert a new "Lab" group (sibling of Pharmacy) with Supplies / Purchase Supplies
anchor = "      { label: 'Laboratory',    path: '/laboratory', icon: FlaskConical, permission: 'laboratory:read' },\n"

if anchor not in content:
    print("ERROR: could not find the Laboratory nav line to insert before. Aborting — no changes made.")
    sys.exit(1)

new_lab_group = """      {
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

content = content.replace(anchor, new_lab_group + anchor)

with open(path, "w") as f:
    f.write(content)

print("Patched:", path)
PYEOF

echo "Done. Diff below:"
echo "---------------------------------------------"
git diff -- "$FILE" || true
