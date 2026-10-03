#!/bin/bash
# Run this from inside your "cms" project root, e.g.:
#   cd "/Users/adminnopassword/Documents/Clinical MS/cms"
#   chmod +x discover_pnl_structure.sh
#   ./discover_pnl_structure.sh > pnl_discovery_output.txt
#
# Then paste the contents of pnl_discovery_output.txt back to me.

echo "=============================================="
echo "1. BACKEND FOLDER STRUCTURE (billing-related)"
echo "=============================================="
find backend/src -maxdepth 3 -iname "*invoice*" -o -iname "*payment*" -o -iname "*expense*" -o -iname "*bed*rent*" -o -iname "*bedrent*" -o -iname "*report*" -o -iname "*credit*" -o -iname "*refund*" 2>/dev/null

echo ""
echo "=============================================="
echo "2. DOES A 'reports' MODULE ALREADY EXIST?"
echo "=============================================="
find backend/src -type d -iname "*report*" 2>/dev/null
echo "--- contents if found ---"
find backend/src -type d -iname "*report*" -exec ls -la {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "3. ENTITY: Invoice"
echo "=============================================="
find backend/src -iname "invoice.entity.ts" -exec echo "--- {} ---" \; -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "4. ENTITY: Payment"
echo "=============================================="
find backend/src -iname "payment.entity.ts" -exec echo "--- {} ---" \; -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "5. ENTITY: Expense"
echo "=============================================="
find backend/src -iname "expense.entity.ts" -exec echo "--- {} ---" \; -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "6. ENTITY: Bed Rent / Bed Rental"
echo "=============================================="
find backend/src -iname "*bed*rent*.entity.ts" -exec echo "--- {} ---" \; -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "7. ENTITY: Credit / Refund"
echo "=============================================="
find backend/src -iname "*credit*.entity.ts" -o -iname "*refund*.entity.ts" 2>/dev/null | while read f; do echo "--- $f ---"; cat "$f"; done

echo ""
echo "=============================================="
echo "8. Any existing reports.controller.ts / reports.service.ts"
echo "=============================================="
find backend/src -iname "reports.controller.ts" -o -iname "reports.service.ts" -o -iname "reports.module.ts" 2>/dev/null | while read f; do echo "--- $f ---"; cat "$f"; done

echo ""
echo "=============================================="
echo "9. Invoices module - list files (to see line items / charges structure)"
echo "=============================================="
find backend/src -type d -iname "*invoice*" -exec find {} -type f \; 2>/dev/null

echo ""
echo "=============================================="
echo "10. Frontend: ProfitLossPage.tsx (current placeholder)"
echo "=============================================="
find frontend/src -iname "ProfitLossPage.tsx" -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "11. Frontend: AccountsReportsPage.tsx"
echo "=============================================="
find frontend/src -iname "AccountsReportsPage.tsx" -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "12. Frontend: services/api.ts (to see existing API call patterns + billing/reports functions)"
echo "=============================================="
find frontend/src -iname "api.ts" -path "*services*" -exec cat {} \; 2>/dev/null

echo ""
echo "=============================================="
echo "13. Database: any existing views/migrations mentioning profit or report"
echo "=============================================="
find database -iname "*.sql" 2>/dev/null | xargs grep -liE "profit|report" 2>/dev/null

echo ""
echo "=============================================="
echo "DONE. Please paste the full output back."
echo "=============================================="
