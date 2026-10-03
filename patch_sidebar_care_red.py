path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

old = '''            <span className="font-extrabold text-2xl leading-tight text-white tracking-wide">
              SOMCARE
            </span>'''

new = '''            <span className="font-extrabold text-2xl leading-tight tracking-wide">
              <span className="text-white">SOM</span><span className="text-red-500">CARE</span>
            </span>'''

if old not in content:
    print("ERROR: wordmark anchor not found — file may already differ. No changes made.")
    raise SystemExit

content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("SUCCESS: 'CARE' is now red, 'SOM' stays white.")
