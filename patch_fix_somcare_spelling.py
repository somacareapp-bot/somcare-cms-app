path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

old = "            SOMACARE\n"
new = "            SOMCARE\n"

if old not in content:
    print("ERROR: 'SOMACARE' text not found in file — it may already be fixed, or the logo patch wasn't applied yet. No changes made.")
    raise SystemExit

content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("SUCCESS: wordmark corrected to 'SOMCARE'.")
