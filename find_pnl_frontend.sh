#!/bin/bash
set -e

echo "=========================================="
echo "1. Locating P&L frontend page"
echo "=========================================="
find frontend/src -iname "*profit*loss*" -name "*.tsx"

echo ""
echo "=========================================="
echo "2. Full contents of the P&L page"
echo "=========================================="
PNL_PAGE=$(find frontend/src -iname "*profit*loss*" -name "*.tsx" | head -1)
if [ -n "$PNL_PAGE" ]; then
  echo "--- $PNL_PAGE ---"
  cat -n "$PNL_PAGE"
else
  echo "(not found by that name — widening search)"
  grep -rl "Operating Expenses\|Cost of Sales\|Staff Salaries" frontend/src --include="*.tsx"
fi

echo ""
echo "=========================================="
echo "3. Any api/reports frontend service used by this page"
echo "=========================================="
grep -rln "profit-loss\|getProfitLoss\|profitLoss" frontend/src --include="*.ts" --include="*.tsx" || echo "(no matches)"
