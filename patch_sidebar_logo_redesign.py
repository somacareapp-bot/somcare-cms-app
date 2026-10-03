path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

logo_variants = [
    # current state (after the logo-swap + spelling-fix patches)
    '''      <div className="flex items-center gap-3 px-4 h-[56px] border-b border-white/10 flex-shrink-0">
        <img src={logoImg} alt="Somacare" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
        {!collapsed && (
          <span className="font-extrabold text-base leading-tight text-white whitespace-nowrap overflow-hidden tracking-wide">
            SOMCARE
          </span>
        )}
      </div>''',
    # in case the spelling-fix patch left the older variable name/text
    '''      <div className="flex items-center gap-3 px-4 h-[56px] border-b border-white/10 flex-shrink-0">
        <img src={logoImg} alt="Somacare" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
        {!collapsed && (
          <span className="font-extrabold text-base leading-tight text-white whitespace-nowrap overflow-hidden tracking-wide">
            SOMACARE
          </span>
        )}
      </div>''',
]

# Big centered icon + bold wordmark + tagline, stacked vertically like the
# reference design. Collapses down to just the icon when the sidebar is
# collapsed.
logo_new = '''      <div
        className={`flex flex-col items-center justify-center flex-shrink-0 border-b border-white/10 ${
          collapsed ? 'py-3' : 'py-7 px-4'
        }`}
      >
        <img
          src={logoImg}
          alt="Somcare"
          className={`object-contain flex-shrink-0 ${collapsed ? 'w-9 h-9' : 'w-20 h-20 mb-2'}`}
        />
        {!collapsed && (
          <>
            <span className="font-extrabold text-2xl leading-tight text-white tracking-wide">
              SOMCARE
            </span>
            <span className="text-[11px] text-white/60 mt-1 tracking-wide text-center">
              Better Health &bull; Brighter Future
            </span>
          </>
        )}
      </div>'''

found_logo = False
for variant in logo_variants:
    if variant in content:
        content = content.replace(variant, logo_new)
        changes += 1
        found_logo = True
        break

if not found_logo:
    print("ERROR: logo block anchor not found — file may already differ from every known version. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes} update — logo block now matches the reference design (big centered icon, bold SOMCARE, tagline).")
