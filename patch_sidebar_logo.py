path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# ── 1. Add the logo image import, right after the auth store import
import_old = "import { useAuthStore } from '../../stores/auth.store';"
import_new = "import { useAuthStore } from '../../stores/auth.store';\nimport logoImg from '../../assets/somacare-logo.png';"

if import_new in content:
    pass  # already added
elif import_old in content:
    content = content.replace(import_old, import_new)
    changes += 1
else:
    print("WARN: import anchor not found")

# ── 2. Swap the "SC" box + "Somcare CMS" text for the real logo image and
#    a bold "SOMACARE" wordmark, no "CMS"
logo_variants = [
    # after the earlier "bold fonts" patch
    '''      <div className="flex items-center gap-3 px-4 h-[56px] border-b border-white/10 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">SC</span>
        </div>
        {!collapsed && (
          <span className="font-bold text-sm leading-tight text-white whitespace-nowrap overflow-hidden">
            Somcare CMS
          </span>
        )}
      </div>''',
    # original, in case the earlier patch wasn't applied
    '''      <div className="flex items-center gap-3 px-4 h-[56px] border-b border-white/10 flex-shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-bold text-xs">SC</span>
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm leading-tight text-white/90 whitespace-nowrap overflow-hidden">
            Somcare CMS
          </span>
        )}
      </div>''',
]
logo_new = '''      <div className="flex items-center gap-3 px-4 h-[56px] border-b border-white/10 flex-shrink-0">
        <img src={logoImg} alt="Somacare" className="w-9 h-9 rounded-lg object-contain flex-shrink-0" />
        {!collapsed && (
          <span className="font-extrabold text-base leading-tight text-white whitespace-nowrap overflow-hidden tracking-wide">
            SOMACARE
          </span>
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
    print("WARN: logo block anchor not found")

if changes == 0:
    print("ERROR: no changes applied — file may already differ from every known version. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes} update(s) — logo image swapped in, brand text is now bold 'SOMACARE' with no 'CMS'.")
