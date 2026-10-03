path = "frontend/src/modules/billing/ProfitLossPage.tsx"
with open(path) as f:
    content = f.read()

# 1. Fix Cost-of-Sales classifier: drop 'supply'/'supplies' so a real
#    Expense.category of 'supplies' isn't swept into Cost of Sales —
#    it belongs in Operating Expenses.
old_keywords = "const COST_OF_SALES_KEYWORDS = ['medicine', 'drug', 'pharmac', 'lab', 'consumable', 'supply', 'supplies'];"
new_keywords = "const COST_OF_SALES_KEYWORDS = ['medicine', 'drug', 'pharmac', 'lab', 'consumable'];"
if old_keywords not in content:
    raise SystemExit("COST_OF_SALES_KEYWORDS line not found — aborting")
content = content.replace(old_keywords, new_keywords, 1)

# 2. Collapse Operating Expenses template down to the real ExpenseCategory
#    enum values (supplies, utilities, maintenance, travel, other) instead
#    of placeholder line items that never match any real data.
old_template = """const OPERATING_EXPENSES_TEMPLATE: TemplateItem[] = [
  { label: 'Staff Salaries', keywords: ['salar', 'staff'] },
  { label: 'Rent', keywords: ['rent'] },
  { label: 'Electricity', keywords: ['electric'] },
  { label: 'Water', keywords: ['water'] },
  { label: 'Internet / Communication', keywords: ['internet', 'communication', 'comm'] },
  { label: 'Transport', keywords: ['transport'] },
  { label: 'Maintenance', keywords: ['maintenance'] },
  { label: 'Office Expenses', keywords: ['office'] },
  { label: 'Other Expenses', keywords: ['other'] },
];"""
new_template = """const OPERATING_EXPENSES_TEMPLATE: TemplateItem[] = [
  { label: 'Supplies', keywords: ['supplies', 'supply'] },
  { label: 'Utilities', keywords: ['utilities', 'utility'] },
  { label: 'Maintenance', keywords: ['maintenance'] },
  { label: 'Travel', keywords: ['travel'] },
  { label: 'Other', keywords: ['other'] },
];"""
if old_template not in content:
    raise SystemExit("OPERATING_EXPENSES_TEMPLATE block not found — aborting")
content = content.replace(old_template, new_template, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
