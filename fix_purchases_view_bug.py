path = "frontend/src/modules/pharmacy/PurchasesPage.tsx"
with open(path) as f:
    content = f.read()

pairs = [
    ("{detail.items.map((it) => (", "{(detail.items ?? []).map((it) => ("),
    ("{printTarget.items.map((it, i) => (", "{(printTarget.items ?? []).map((it, i) => ("),
]
for old, new in pairs:
    if old not in content:
        raise SystemExit(f"Pattern not found, aborting: {old!r}")
    content = content.replace(old, new, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
