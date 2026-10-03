#!/bin/bash
set -e

echo "=========================================="
echo "1. Locating P&L / profit-loss backend files"
echo "=========================================="
grep -rl "profit-loss\|profitLoss\|ProfitLoss" backend/src --include="*.ts" || echo "(no matches)"

echo ""
echo "=========================================="
echo "2. Locating Expense entity"
echo "=========================================="
find backend/src -iname "*expense*" -name "*.ts"

echo ""
echo "=========================================="
echo "3. Expense entity contents"
echo "=========================================="
EXPENSE_ENTITY=$(find backend/src -iname "*expense*.entity.ts" | head -1)
if [ -n "$EXPENSE_ENTITY" ]; then
  echo "--- $EXPENSE_ENTITY ---"
  cat "$EXPENSE_ENTITY"
else
  echo "(no expense entity file found by that name pattern)"
fi

echo ""
echo "=========================================="
echo "4. P&L / reports service contents"
echo "=========================================="
PNL_FILE=$(grep -rl "profit-loss\|profitLoss\|ProfitLoss\|Operating Expenses\|OPERATING_EXPENSES" backend/src --include="*.ts" | grep -iv spec | head -1)
if [ -n "$PNL_FILE" ]; then
  echo "--- $PNL_FILE ---"
  cat "$PNL_FILE"
else
  echo "(no P&L service file found — try widening the grep)"
fi

echo ""
echo "=========================================="
echo "5. Reports module/controller (routing to confirm the exact endpoint file)"
echo "=========================================="
find backend/src -ipath "*reports*" -name "*.ts" | grep -iv spec

echo ""
echo "=========================================="
echo "6. Any existing 'category' enum/type used by Expense"
echo "=========================================="
grep -rn "ExpenseCategory\|expense_category\|category:" backend/src --include="*.ts" | grep -i expense || echo "(no matches)"
