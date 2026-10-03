#!/bin/bash
set -e
cd "$(dirname "$0")" 2>/dev/null || true
echo "📁 Working directory: $(pwd)"

for f in \
  backend/src/expenses/entities/expense.entity.ts \
  backend/src/expenses/dto/create-expense.dto.ts \
  backend/src/expenses/dto/review-expense.dto.ts \
  backend/src/expenses/dto/approve-expense.dto.ts \
  backend/src/expenses/expenses.service.ts \
  backend/src/expenses/expenses.controller.ts
do
  echo ""
  echo "----- FILE: $f -----"
  if [ -f "$f" ]; then
    cat -n "$f"
  else
    echo "(not found)"
  fi
done

echo ""
echo "🎉 Done. Paste this whole output back."
