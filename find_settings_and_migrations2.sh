#!/bin/bash
# no 'set -e' — grep/find with no matches is expected and fine here

echo "=========================================="
echo "0. TypeORM config — confirm synchronize mode"
echo "=========================================="
grep -rn "synchronize" backend/src --include="*.ts"

echo ""
echo "=========================================="
echo "1. Any migrations folder anywhere in the project"
echo "=========================================="
find . -maxdepth 5 -type d -iname "*migration*" 2>/dev/null | grep -v node_modules

echo ""
echo "=========================================="
echo "2. Is Supplier a real entity anywhere?"
echo "=========================================="
find backend/src -iname "*supplier*"

echo ""
echo "=========================================="
echo "3. Where does D.suppliersStore / D.departmentsStore come from? (the data facade)"
echo "=========================================="
grep -rln "suppliersStore" frontend/src --include="*.ts" --include="*.tsx"

echo ""
echo "=========================================="
echo "4. Full Expense module files"
echo "=========================================="
echo "--- create-expense.dto.ts ---"
cat -n backend/src/expenses/dto/create-expense.dto.ts
echo "--- expenses.service.ts ---"
cat -n backend/src/expenses/expenses.service.ts
echo "--- expenses.controller.ts ---"
cat -n backend/src/expenses/expenses.controller.ts

echo ""
echo "=========================================="
echo "5. EditableTable component"
echo "=========================================="
find frontend/src -iname "EditableTable.tsx" -exec cat -n {} \;

echo ""
echo "=========================================="
echo "6. Frontend Expense form (category dropdown)"
echo "=========================================="
grep -rln "ExpenseCategory\|createExpense" frontend/src --include="*.tsx"
