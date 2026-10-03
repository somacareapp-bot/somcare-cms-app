path = "frontend/src/modules/pharmacy/PurchasesPage.tsx"
with open(path) as f:
    content = f.read()

pairs = [
    # Table wrapper: allow horizontal scroll instead of clipping
    (
        '<div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">',
        '<div className="bg-white rounded-xl border border-clinical-200 overflow-x-auto">',
    ),
    # Header actions cell: sticky to the right, opaque background so scrolled content doesn't show through
    (
        '<th className="px-4 py-3" />',
        '<th className="px-4 py-3 sticky right-0 bg-clinical-50" />',
    ),
    # Body actions cell: sticky to the right, opaque background (matches row hover)
    (
        '<td className="px-4 py-3">\n                      <div className="flex items-center gap-1.5 justify-end relative">',
        '<td className="px-4 py-3 sticky right-0 bg-white group-hover:bg-clinical-50">\n                      <div className="flex items-center gap-1.5 justify-end relative">',
    ),
    # Row needs 'group' so the sticky cell's hover background can track the row hover
    (
        '<tr key={p.id} className="hover:bg-clinical-50 transition-colors">',
        '<tr key={p.id} className="group hover:bg-clinical-50 transition-colors">',
    ),
]
for old, new in pairs:
    if old not in content:
        raise SystemExit(f"Pattern not found, aborting: {old!r}")
    content = content.replace(old, new, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
