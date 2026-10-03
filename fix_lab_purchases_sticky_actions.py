path = "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx"
with open(path) as f:
    content = f.read()

pairs = [
    (
        '<div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">',
        '<div className="bg-white rounded-xl border border-clinical-200 overflow-x-auto">',
    ),
    (
        '<th className="px-4 py-3" />',
        '<th className="px-4 py-3 sticky right-0 bg-clinical-50" />',
    ),
    (
        '<tr key={p.id} className="hover:bg-clinical-50 transition-colors">',
        '<tr key={p.id} className="group hover:bg-clinical-50 transition-colors">',
    ),
]
for old, new in pairs:
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match, found {count}: {old!r}")
    content = content.replace(old, new, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
