#!/bin/bash
cd "/Users/adminnopassword/Documents/Clinical MS/cms" || exit 1
echo "── ExpensesPage.tsx ─────────────────────────────────────────────────────"
cat -n frontend/src/modules/billing/ExpensesPage.tsx
echo ""
echo "── auth.store.ts (for hasRole / user shape) ────────────────────────────"
cat -n frontend/src/stores/auth.store.ts 2>/dev/null | head -60
