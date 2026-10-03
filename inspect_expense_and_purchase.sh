#!/usr/bin/env bash
# Inspects how "Expenses" implements its approval workflow, and how
# Lab/Pharmacy purchase invoices are currently modeled, so we can
# replicate the Submitted -> Admin review -> Accountant Paid pipeline
# on purchases with role-specific "submitted by" labels
# (Lab Technician / Pharmacist).
#
# Run from your project root:
#   bash inspect_expense_and_purchase.sh > inspect_output.txt
# Then paste the contents of inspect_output.txt back to me.

set -uo pipefail

section () {
  echo ""
  echo "================================================================"
  echo "== $1"
  echo "================================================================"
}

ROOT="$(pwd)"
echo "Project root: $ROOT"

section "1. Files with 'expense' in the name"
find . -iname "*expense*" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" \
  2>/dev/null

section "2. Files with 'purchase' in the name"
find . -iname "*purchase*" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*" \
  2>/dev/null

section "3. Occurrences of status words used by Expenses (Submitted/Pending/Approved/Paid/Rejected)"
grep -rniE "submitted|pending.?review|admin.?review|approved|accountant|status.*paid" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
  . 2>/dev/null | grep -i "expense"

section "4. Expense type/interface/enum definitions"
grep -rniE "enum .*Status|type .*Status|interface Expense|type Expense" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
  . 2>/dev/null

section "5. Purchase invoice type/interface/enum definitions (Lab + Pharmacy)"
grep -rniE "enum .*Status|type .*Status|interface Purchase|type Purchase|PurchaseInvoice" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
  . 2>/dev/null

section "6. Where 'Paid' / status badge is rendered on purchase pages"
grep -rniE "status.*paid|badge" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=dist --exclude-dir=build \
  . 2>/dev/null | grep -iE "purchase|lab-supplies|pharmacy"

section "7. Expense approval workflow UI component (if it exists as its own component)"
find . -iname "*approval*" -o -iname "*workflow*" \
  -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null

section "8. Full content of any file whose path contains 'expense' AND ('type' or 'model' or 'service')"
for f in $(find . -iname "*expense*" \( -iname "*type*" -o -iname "*model*" -o -iname "*service*" -o -iname "*status*" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null); do
  echo ""
  echo "---- FILE: $f ----"
  cat "$f"
done

section "9. Full content of purchase invoice type/model files (Lab + Pharmacy)"
for f in $(find . -iname "*purchase*" \( -iname "*type*" -o -iname "*model*" -o -iname "*service*" -o -iname "*status*" \) \
  -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null); do
  echo ""
  echo "---- FILE: $f ----"
  cat "$f"
done

echo ""
echo "Done. Paste the full output back."
