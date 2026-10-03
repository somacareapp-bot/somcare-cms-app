#!/usr/bin/env bash
# Pass 2: full content of the exact files needed to design the
# Lab/Pharmacy purchase approval workflow (Submitted -> Admin Review
# -> Accountant Paid), modeled on Expenses.
#
# Run from your project root:
#   bash inspect_purchase_deep.sh > inspect_output_2.txt
# Then paste the contents of inspect_output_2.txt back to me.

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

FILES=(
  # Expenses — full picture (some were only partially shown before)
  "backend/src/expenses/entities/expense.entity.ts"
  "backend/src/expenses/dto/create-expense.dto.ts"
  "backend/src/expenses/dto/review-expense.dto.ts"
  "backend/src/expenses/dto/approve-expense.dto.ts"
  "backend/src/expenses/expenses.controller.ts"
  "backend/src/expenses/expenses.module.ts"

  # Pharmacy purchases
  "backend/src/pharmacy/entities/purchase.entity.ts"
  "backend/src/pharmacy/entities/purchase-item.entity.ts"
  "backend/src/pharmacy/dto/create-purchase.dto.ts"
  "backend/src/pharmacy/dto/record-purchase-payment.dto.ts"

  # Lab supply purchases
  "backend/src/inventory/entities/lab-supply-purchase.entity.ts"
  "backend/src/inventory/entities/lab-supply-purchase-item.entity.ts"
  "backend/src/inventory/dto/create-lab-supply-purchase.dto.ts"
  "backend/src/inventory/dto/record-lab-supply-purchase-payment.dto.ts"

  # Roles
  "backend/src/users/entities/user.entity.ts"
)

for f in "${FILES[@]}"; do
  show "$f"
done

echo ""
echo "================================================================"
echo "== pharmacy.service.ts / pharmacy.controller.ts (purchase-related methods only)"
echo "================================================================"
grep -n "" backend/src/pharmacy/pharmacy.service.ts 2>/dev/null | grep -iE "purchase" -A3 -B1
echo "--- controller purchase routes ---"
grep -n "" backend/src/pharmacy/pharmacy.controller.ts 2>/dev/null | grep -iE "purchase" -A3 -B1

echo ""
echo "================================================================"
echo "== inventory service/controller (lab supply purchase-related methods only)"
echo "================================================================"
find backend/src/inventory -iname "*.service.ts" -o -iname "*.controller.ts" 2>/dev/null
for f in $(find backend/src/inventory -iname "*.service.ts" -o -iname "*.controller.ts" 2>/dev/null); do
  echo ""
  echo "---- FILE: $f ----"
  cat "$f"
done

echo ""
echo "================================================================"
echo "== Frontend: PurchasesPage.tsx (pharmacy) — first 120 lines (types + status logic)"
echo "================================================================"
sed -n '1,120p' frontend/src/modules/pharmacy/PurchasesPage.tsx 2>/dev/null

echo ""
echo "================================================================"
echo "== Frontend: LabSuppliesPurchasesPage.tsx (inventory) — first 120 lines (types + status logic)"
echo "================================================================"
sed -n '1,120p' frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx 2>/dev/null

echo ""
echo "Done. Paste the full output back."
