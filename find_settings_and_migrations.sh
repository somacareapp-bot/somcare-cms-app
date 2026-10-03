#!/bin/bash
set -e

echo "=========================================="
echo "1. Migrations folder — naming convention + one example"
echo "=========================================="
find backend/src -ipath "*migration*" -name "*.ts" | sort
echo "--- sample migration (most recent) ---"
LATEST_MIGRATION=$(find backend/src -ipath "*migration*" -name "*.ts" | sort | tail -1)
if [ -n "$LATEST_MIGRATION" ]; then cat -n "$LATEST_MIGRATION"; fi

echo ""
echo "=========================================="
echo "2. An existing simple lookup entity (Supplier) for pattern reference"
echo "=========================================="
find backend/src -iname "*supplier*.entity.ts" -exec cat -n {} \;

echo ""
echo "=========================================="
echo "3. Supplier module/controller/service (backend CRUD pattern)"
echo "=========================================="
find backend/src -ipath "*supplier*" -name "*.ts" | grep -iv spec
echo "--- supplier.service.ts (if exists) ---"
find backend/src -iname "*supplier*.service.ts" -exec cat -n {} \;
echo "--- supplier.controller.ts (if exists) ---"
find backend/src -iname "*supplier*.controller.ts" -exec cat -n {} \;

echo ""
echo "=========================================="
echo "4. Full Expense module files (entity already have, need these three)"
echo "=========================================="
echo "--- create-expense.dto.ts ---"
cat -n backend/src/expenses/dto/create-expense.dto.ts
echo "--- expenses.service.ts ---"
cat -n backend/src/expenses/expenses.service.ts
echo "--- expenses.controller.ts ---"
cat -n backend/src/expenses/expenses.controller.ts

echo ""
echo "=========================================="
echo "5. Frontend data-store facade 'D' used by EditableTable (find its definition)"
echo "=========================================="
grep -rln "suppliersStore\|departmentsStore" frontend/src --include="*.ts" --include="*.tsx" | grep -iv SettingsPage

echo ""
echo "=========================================="
echo "6. EditableTable component (frontend pattern for lookup tables)"
echo "=========================================="
find frontend/src -iname "EditableTable.tsx" -exec cat -n {} \;

echo ""
echo "=========================================="
echo "7. Frontend Expense form (where category dropdown currently lives)"
echo "=========================================="
grep -rln "ExpenseCategory\|create-expense\|createExpense" frontend/src --include="*.tsx"
