paths = [
    "frontend/src/modules/pharmacy/PurchasesPage.tsx",
    "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx",
]

old_fmt = """function fmt(n: number) {
  return `$${n.toFixed(2)}`;
}"""
new_fmt = """function fmt(n: number | string) {
  return `$${Number(n).toFixed(2)}`;
}"""

for path in paths:
    with open(path) as f:
        content = f.read()
    if old_fmt not in content:
        raise SystemExit(f"fmt() pattern not found in {path}, aborting")
    content = content.replace(old_fmt, new_fmt, 1)
    with open(path, "w") as f:
        f.write(content)
    print("Patched fmt():", path)
