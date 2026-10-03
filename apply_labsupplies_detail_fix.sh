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

patch("frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx", [
    (
        '                  <span className="text-clinical-700">{it.quantity} × {it.labSupply.name}</span>\n',
        '                  <span className="text-clinical-700">{it.quantity} × {it.labSupply?.name ?? \'Unknown item\'}</span>\n',
    ),
    (
        '                      <td className="py-2 px-2 font-medium text-clinical-800">{it.labSupply.name}</td>\n'
        '                      <td className="py-2 px-2 text-right text-clinical-500">{it.labSupply.unit}</td>\n',
        '                      <td className="py-2 px-2 font-medium text-clinical-800">{it.labSupply?.name ?? \'Unknown item\'}</td>\n'
        '                      <td className="py-2 px-2 text-right text-clinical-500">{it.labSupply?.unit ?? \'\'}</td>\n',
    ),
], "LabSuppliesPurchasesPage.tsx")

print("\nDone.")
PYEOF
