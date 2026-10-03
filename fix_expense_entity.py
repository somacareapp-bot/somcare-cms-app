path = "backend/src/expenses/entities/expense.entity.ts"
with open(path) as f:
    content = f.read()

old_enum_block = """export enum ExpenseCategory {
  SUPPLIES = 'supplies',
  UTILITIES = 'utilities',
  MAINTENANCE = 'maintenance',
  TRAVEL = 'travel',
  OTHER = 'other',
}

"""
if old_enum_block not in content:
    raise SystemExit("Old ExpenseCategory enum block not found — aborting")
content = content.replace(old_enum_block, "", 1)

old_column = """  @Column({ type: 'enum', enum: ExpenseCategory, default: ExpenseCategory.OTHER })
  category: ExpenseCategory;"""
new_column = """  // Stores the `code` of a row in expense_categories (see
  // expense-category.entity.ts) — plain string, not a DB enum or FK, so
  // deactivating/renaming a category later never breaks historical rows.
  @Column({ default: 'other' })
  category: string;"""
if old_column not in content:
    raise SystemExit("Old category @Column not found — aborting")
content = content.replace(old_column, new_column, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
