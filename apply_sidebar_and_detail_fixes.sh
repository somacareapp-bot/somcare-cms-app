#!/bin/bash
set -e

python3 << 'PYEOF'
import sys

def patch(path, replacements, label):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        count = content.count(old)
        if count != 1:
            print(f"FAILED [{label}]: expected 1 match, found {count} for anchor starting: {old[:70]!r}")
            sys.exit(1)
        content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched: {path}")

# ---------------------------------------------------------------------------
# 1. Sidebar.tsx — stop the top-level 'inventory:read' from short-circuiting
#    canSee() before it looks at which branch (Lab vs Pharmacy) actually
#    applies. Lab keeps its own 'inventory:read' gate; Pharmacy now relies
#    purely on its children's 'pharmacy:read' gate.
# ---------------------------------------------------------------------------
patch("frontend/src/components/layout/Sidebar.tsx", [
    (
        "      {\n"
        "        label: 'Inventory',\n"
        "        path: '/inventory',\n"
        "        icon: Package,\n"
        "        permission: 'inventory:read',\n"
        "        children: [\n",
        "      {\n"
        "        label: 'Inventory',\n"
        "        path: '/inventory',\n"
        "        icon: Package,\n"
        "        children: [\n",
    ),
    (
        "          {\n"
        "            label: 'Pharmacy',\n"
        "            path: '/inventory/pharmacy',\n"
        "            icon: Pill,\n"
        "            permission: 'inventory:read',\n"
        "            children: [\n",
        "          {\n"
        "            label: 'Pharmacy',\n"
        "            path: '/inventory/pharmacy',\n"
        "            icon: Pill,\n"
        "            children: [\n",
    ),
], "Sidebar.tsx")

# ---------------------------------------------------------------------------
# 2. PurchasesPage.tsx — it.medicine.name crashes the whole page (blank
#    screen) whenever the medicine relation isn't present on an item.
#    Guard both the detail modal and the print modal.
# ---------------------------------------------------------------------------
patch("frontend/src/modules/pharmacy/PurchasesPage.tsx", [
    (
        '                  <span className="text-clinical-700">{it.quantity} × {it.medicine.name}</span>\n',
        '                  <span className="text-clinical-700">{it.quantity} × {it.medicine?.name ?? \'Unknown item\'}</span>\n',
    ),
    (
        '                      <td className="py-2 px-2 font-medium text-clinical-800">{it.medicine.name}</td>\n'
        '                      <td className="py-2 px-2 text-right text-clinical-500">{it.medicine.unit}</td>\n',
        '                      <td className="py-2 px-2 font-medium text-clinical-800">{it.medicine?.name ?? \'Unknown item\'}</td>\n'
        '                      <td className="py-2 px-2 text-right text-clinical-500">{it.medicine?.unit ?? \'\'}</td>\n',
    ),
], "PurchasesPage.tsx")

print("\nDone.")
PYEOF
