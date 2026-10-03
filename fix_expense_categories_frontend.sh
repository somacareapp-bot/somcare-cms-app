#!/usr/bin/env bash
# =============================================================================
# fix_expense_categories_frontend.sh
#
# Wires the dynamic expense-category API into the frontend:
#   1. Adds expenseCategoriesApi to frontend/src/services/api.ts
#   2. Patches frontend/src/modules/billing/ExpensesPage.tsx
#        - removes hardcoded CATEGORIES / ExpenseCategory type
#        - fetches live categories from the API
#        - upgrades the category <select> to show group › label
#        - fixes Submit disabled guard, table cell, view modal, Excel export
#
# Run from the repo root:  bash fix_expense_categories_frontend.sh
# =============================================================================
set -euo pipefail

API_FILE="frontend/src/services/api.ts"
PAGE_FILE="frontend/src/modules/billing/ExpensesPage.tsx"

# ── guard ────────────────────────────────────────────────────────────────────
for f in "$API_FILE" "$PAGE_FILE"; do
  [[ -f "$f" ]] || { echo "ERROR: $f not found. Run from the repo root."; exit 1; }
done

echo "=== Step 1: Add expenseCategoriesApi to $API_FILE ==="

if grep -q "expenseCategoriesApi" "$API_FILE"; then
  echo "  Already present — skipping."
else
  python3 - "$API_FILE" << 'PYEOF'
import sys
path = sys.argv[1]
with open(path) as f:
    content = f.read()

anchor = """export const expensesApi = {"""
insert = """export const expenseCategoriesApi = {
  getGroups: () => api.get('/api/expense-categories/groups'),
  getAll: (includeInactive = false) =>
    api.get('/api/expense-categories', { params: { includeInactive: includeInactive || undefined } }),
  create: (data: any) => api.post('/api/expense-categories', data),
  update: (id: string, data: any) => api.patch(`/api/expense-categories/${id}`, data),
  deactivate: (id: string) => api.patch(`/api/expense-categories/${id}/deactivate`),
};

"""

if anchor not in content:
    raise SystemExit("ERROR: could not find 'export const expensesApi' anchor in api.ts")

content = content.replace(anchor, insert + anchor, 1)
with open(path, "w") as f:
    f.write(content)
print("  expenseCategoriesApi inserted.")
PYEOF
fi

echo ""
echo "=== Step 2: Patch $PAGE_FILE ==="

python3 - "$PAGE_FILE" << 'PYEOF'
import sys, re
path = sys.argv[1]
with open(path) as f:
    src = f.read()

changes = []

# ── 2a. Update the import line to add expenseCategoriesApi ──────────────────
old_import = "import { expensesApi } from '../../services/api';"
new_import = "import { expensesApi, expenseCategoriesApi } from '../../services/api';"
if old_import in src:
    src = src.replace(old_import, new_import, 1)
    changes.append("2a: updated api import")
elif "expenseCategoriesApi" in src:
    changes.append("2a: import already updated — skipped")
else:
    raise SystemExit("ERROR 2a: could not find expensesApi import line")

# ── 2b. Remove the old type ExpenseCategory and const CATEGORIES ─────────────
old_type_and_cats = """\
// Mirrors backend/src/expenses/entities/expense.entity.ts exactly.
type ExpenseStatus = 'pending' | 'accountant_confirmed' | 'approved' | 'sent_back' | 'rejected';
type ExpenseCategory = 'supplies' | 'utilities' | 'maintenance' | 'travel' | 'other';

interface Expense {
  id: string;
  description: string;
  amount: string | number;
  category: ExpenseCategory;"""

new_type_and_cats = """\
// Mirrors backend/src/expenses/entities/expense.entity.ts exactly.
type ExpenseStatus = 'pending' | 'accountant_confirmed' | 'approved' | 'sent_back' | 'rejected';

// category is now a plain string code resolved from the expense_categories table
interface ExpenseCategory { id: string; code: string; label: string; group: { label: string }; active: boolean; }

interface Expense {
  id: string;
  description: string;
  amount: string | number;
  category: string;"""

if old_type_and_cats in src:
    src = src.replace(old_type_and_cats, new_type_and_cats, 1)
    changes.append("2b: replaced type/interface block")
elif "interface ExpenseCategory { id: string" in src:
    changes.append("2b: already patched — skipped")
else:
    raise SystemExit("ERROR 2b: could not find old ExpenseCategory type block")

# ── 2c. Remove old hardcoded CATEGORIES array ────────────────────────────────
old_cats = """\
const CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'supplies', label: 'Supplies' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'travel', label: 'Travel' },
  { value: 'other', label: 'Other' },
];

"""
if old_cats in src:
    src = src.replace(old_cats, "", 1)
    changes.append("2c: removed hardcoded CATEGORIES array")
elif "value: 'supplies', label: 'Supplies'" not in src:
    changes.append("2c: CATEGORIES already removed — skipped")
else:
    raise SystemExit("ERROR 2c: could not find hardcoded CATEGORIES array")

# ── 2d. Add live categories query inside the component ───────────────────────
old_qc = "  const queryClient = useQueryClient();\n\n  const [draft"
new_qc = """\
  const queryClient = useQueryClient();

  // Live categories from the expense_categories table
  const { data: categoryData } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: () => expenseCategoriesApi.getAll().then((r) => r.data as ExpenseCategory[]),
    staleTime: 5 * 60 * 1000,
  });
  const categories = categoryData ?? [];

  const [draft"""
if old_qc in src:
    src = src.replace(old_qc, new_qc, 1)
    changes.append("2d: added categories query")
elif "expenseCategoriesApi.getAll()" in src:
    changes.append("2d: categories query already present — skipped")
else:
    raise SystemExit("ERROR 2d: could not find queryClient anchor")

# ── 2e. Fix emptyDraft — change category default ─────────────────────────────
old_draft = "  category: 'other' as ExpenseCategory,"
new_draft = "  category: '',"
if old_draft in src:
    src = src.replace(old_draft, new_draft, 1)
    changes.append("2e: fixed emptyDraft category default")
elif "category: ''," in src:
    changes.append("2e: emptyDraft already fixed — skipped")
else:
    raise SystemExit("ERROR 2e: could not find emptyDraft category line")

# ── 2f. Replace the hardcoded <select> with a grouped live one ───────────────
old_select = """\
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value as ExpenseCategory })}
            className={inputCls}
            style={{ flex: '0 1 140px' }}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>"""
new_select = """\
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            className={inputCls}
            style={{ flex: '0 1 220px' }}
          >
            <option value="">— Category —</option>
            {categories.map((c) => (
              <option key={c.code} value={c.code}>
                {c.group.label} › {c.label}
              </option>
            ))}
          </select>"""
if old_select in src:
    src = src.replace(old_select, new_select, 1)
    changes.append("2f: replaced hardcoded <select> with live grouped select")
elif "c.group.label} › {c.label}" in src:
    changes.append("2f: <select> already patched — skipped")
else:
    raise SystemExit("ERROR 2f: could not find hardcoded category <select>")

# ── 2g. Add !draft.category to Submit button disabled guard ──────────────────
old_disabled = "disabled={!draft.date || !draft.amount || !draft.description || createMutation.isPending}"
new_disabled = "disabled={!draft.date || !draft.amount || !draft.description || !draft.category || createMutation.isPending}"
if old_disabled in src:
    src = src.replace(old_disabled, new_disabled, 1)
    changes.append("2g: added !draft.category to Submit disabled guard")
elif "!draft.category" in src:
    changes.append("2g: disabled guard already has !draft.category — skipped")
else:
    raise SystemExit("ERROR 2g: could not find Submit disabled guard")

# ── 2h. Fix category label in the table cell ────────────────────────────────
old_cell = """\
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-clinical-100 text-clinical-600 capitalize">
                            {e.category}
                          </span>
                        </td>"""
new_cell = """\
                        <td className="px-5 py-3">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-clinical-100 text-clinical-600 capitalize">
                            {categories.find((c) => c.code === e.category)?.label ?? e.category}
                          </span>
                        </td>"""
if old_cell in src:
    src = src.replace(old_cell, new_cell, 1)
    changes.append("2h: fixed table cell category label")
elif "categories.find((c) => c.code === e.category)" in src:
    changes.append("2h: table cell already patched — skipped")
else:
    raise SystemExit("ERROR 2h: could not find category table cell")

# ── 2i. Fix category label in the view modal ────────────────────────────────
old_modal = "                  <p className=\"text-sm text-clinical-700 capitalize\">{viewExpense.category}</p>"
new_modal = "                  <p className=\"text-sm text-clinical-700 capitalize\">{categories.find((c) => c.code === viewExpense.category)?.label ?? viewExpense.category}</p>"
if old_modal in src:
    src = src.replace(old_modal, new_modal, 1)
    changes.append("2i: fixed view modal category label")
elif "categories.find((c) => c.code === viewExpense.category)" in src:
    changes.append("2i: view modal already patched — skipped")
else:
    raise SystemExit("ERROR 2i: could not find view modal category line")

# ── 2j. Fix Category in exportToExcel ────────────────────────────────────────
old_export = "      Category: e.category,"
new_export = "      Category: categories.find((c) => c.code === e.category)?.label ?? e.category,"
if old_export in src:
    src = src.replace(old_export, new_export, 1)
    changes.append("2j: fixed exportToExcel Category field")
elif "categories.find((c) => c.code === e.category)?.label" in src:
    changes.append("2j: exportToExcel already patched — skipped")
else:
    raise SystemExit("ERROR 2j: could not find exportToExcel Category line")

with open(path, "w") as f:
    f.write(src)

print("  Changes applied:")
for c in changes:
    print("   ✓", c)
PYEOF

echo ""
echo "=== All done! ==="
echo ""
echo "Next steps:"
echo "  1. Restart your backend (NestJS) so the new ExpenseCategoriesController is live."
echo "  2. Restart / hot-reload your frontend (Vite) — no npm install needed."
echo "  3. Open Expenses → New Expense — the Category dropdown now shows"
echo "     live groups from the database (e.g. 'Staff & Human Resources › Salaries & Wages')."
echo ""
echo "Optional: to add a Settings panel to manage categories, ask Claude for"
echo "  the ExpenseCategoriesPanel component wired to EditableTable + ApiListStore."
