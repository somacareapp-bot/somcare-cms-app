path = "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx"
with open(path) as f:
    content = f.read()

old = '''                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end relative">
                        <button
                          onClick={() => setDetail(p)}'''
new = '''                    <td className="px-4 py-3 sticky right-0 bg-white group-hover:bg-clinical-50">
                      <div className="flex items-center gap-1.5 justify-end relative">
                        <button
                          onClick={() => setDetail(p)}'''

count = content.count(old)
if count != 1:
    raise SystemExit(f"Expected exactly 1 match, found {count}")
content = content.replace(old, new, 1)

with open(path, "w") as f:
    f.write(content)
print("Patched:", path)
