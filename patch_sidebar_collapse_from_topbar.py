path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# ── 1. Drop the now-unused useState import (collapsed comes in as a prop now)
old_import = "import { useAuthStore } from '../../stores/auth.store';\nimport { useState } from 'react';\n"
new_import = "import { useAuthStore } from '../../stores/auth.store';\n"
if old_import in content:
    content = content.replace(old_import, new_import)
    changes += 1
else:
    print("WARN: useState import anchor not found (may already be removed)")

# ── 2. Drop ChevronRight from the lucide-react import (only used by the
#    Collapse button we're removing)
old_icon_import = "  Settings,\n  LogOut,\n  ChevronRight,\n} from 'lucide-react';"
new_icon_import = "  Settings,\n  LogOut,\n} from 'lucide-react';"
if old_icon_import in content:
    content = content.replace(old_icon_import, new_icon_import)
    changes += 1
else:
    print("WARN: ChevronRight import anchor not found")

# ── 3. Component signature: accept `collapsed` as a prop instead of owning
#    local state
old_sig = '''export function Sidebar() {
  const location = useLocation();
  const { user, hasPermission, hasRole, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);'''
new_sig = '''export function Sidebar({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();
  const { user, hasPermission, hasRole, logout } = useAuthStore();'''
if old_sig in content:
    content = content.replace(old_sig, new_sig)
    changes += 1
else:
    print("ERROR: component signature anchor not found — aborting without writing.")
    raise SystemExit

# ── 4. Remove the "Collapse toggle" button from the footer entirely
collapse_button_variants = [
    # after the "bold fonts" patch (font-semibold span)
    '''        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-white/50 hover:text-white hover:bg-white/8 text-xs transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
          {!collapsed && <span className="font-semibold">Collapse</span>}
        </button>

''',
    # original, in case the bold-fonts patch wasn't applied to this button
    '''        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className={`flex items-center gap-2 w-full rounded-lg px-2.5 py-2 text-white/50 hover:text-white hover:bg-white/8 text-xs transition-colors ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <ChevronRight
            size={14}
            className={`transition-transform ${collapsed ? '' : 'rotate-180'}`}
          />
          {!collapsed && <span>Collapse</span>}
        </button>

''',
]
found_button = False
for variant in collapse_button_variants:
    if variant in content:
        content = content.replace(variant, "")
        changes += 1
        found_button = True
        break
if not found_button:
    print("WARN: Collapse button block anchor not found")

if changes == 0:
    print("ERROR: no changes applied — file may already differ from every known version. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes} update(s) — Sidebar now takes 'collapsed' as a prop, footer Collapse button removed. Toggle it from the top bar's Menu icon instead.")
