#!/usr/bin/env bash
# Pass 3 — last round of inspection before I write the actual patch.
# I have inventory.service.ts / inventory.controller.ts in full already,
# and the entities/DTOs for both purchase types. What's still missing:
#   - pharmacy.service.ts and pharmacy.controller.ts in FULL (I've only
#     seen grep fragments around the purchase methods, and that file also
#     handles medicines/POS/sales, so I don't want to guess at the parts
#     I haven't seen)
#   - both purchase frontend pages in FULL (I've only seen the first 120
#     lines of each — need the table rows, action buttons and modals)
#   - the actual role slugs in your roles table, so "Lab Technician" /
#     "Pharmacist" map to real @Roles(...) strings instead of guesses
#
# Run from your project root:
#   bash inspect_purchase_final.sh > inspect_output_3.txt
# Then paste the contents of inspect_output_3.txt back to me.

set -uo pipefail

show () {
  echo ""
  echo "---- FILE: $1 ----"
  if [ -f "$1" ]; then
    cat "$1"
  else
    echo "(missing)"
  fi
}

show "backend/src/pharmacy/pharmacy.service.ts"
show "backend/src/pharmacy/pharmacy.controller.ts"
show "backend/src/pharmacy/pharmacy.module.ts"
show "frontend/src/modules/pharmacy/PurchasesPage.tsx"
show "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx"
show "backend/src/users/entities/role.entity.ts"
show "backend/src/auth/decorators/roles.decorator.ts"
show "backend/src/auth/guards/roles.guard.ts"

echo ""
echo "================================================================"
echo "== Actual role names currently in the database (if psql/sqlite reachable)"
echo "================================================================"
# Try a couple of common local setups; harmless if these fail.
if command -v psql >/dev/null 2>&1; then
  psql "${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/postgres}" -c "SELECT name FROM roles;" 2>&1 || true
fi
grep -rniE "name:\s*'[a-z_]+'" backend/src --include="*.ts" 2>/dev/null | grep -iE "role|seed" | head -50

echo ""
echo "Done. Paste the full output back."
