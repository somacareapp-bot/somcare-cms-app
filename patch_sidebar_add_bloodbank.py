path = "frontend/src/components/layout/Sidebar.tsx"
with open(path, "r") as f:
    content = f.read()

changes = 0

# ── 1. Add the Droplet icon to the lucide-react import
old_icon_import = "  Settings,\n  LogOut,\n} from 'lucide-react';"
new_icon_import = "  Settings,\n  LogOut,\n  Droplet,\n} from 'lucide-react';"
if new_icon_import in content:
    pass  # already added
elif old_icon_import in content:
    content = content.replace(old_icon_import, new_icon_import)
    changes += 1
else:
    # fall back to the pre-collapse-patch import shape (with ChevronRight still present)
    old_icon_import_alt = "  Settings,\n  LogOut,\n  ChevronRight,\n} from 'lucide-react';"
    new_icon_import_alt = "  Settings,\n  LogOut,\n  ChevronRight,\n  Droplet,\n} from 'lucide-react';"
    if old_icon_import_alt in content:
        content = content.replace(old_icon_import_alt, new_icon_import_alt)
        changes += 1
    else:
        print("WARN: lucide-react import anchor not found")

# ── 2. Add the Blood Bank nav item to the Clinical section, after Bed Management
old_clinical = """      { label: 'Bed Management',path: '/beds',                   icon: BedDouble,   permission: 'beds:read' },
    ],
    hideForRoles: ['accountant'],
  },"""
new_clinical = """      { label: 'Bed Management',path: '/beds',                   icon: BedDouble,   permission: 'beds:read' },
      { label: 'Blood Bank',    path: '/blood-bank',             icon: Droplet,     permission: 'bloodbank:read' },
    ],
    hideForRoles: ['accountant'],
  },"""
if new_clinical in content:
    pass  # already added
elif old_clinical in content:
    content = content.replace(old_clinical, new_clinical)
    changes += 1
else:
    print("ERROR: Clinical section anchor not found — aborting without writing.")
    raise SystemExit

if changes == 0:
    print("ERROR: no changes applied — file may already differ. Aborting without writing.")
    raise SystemExit

with open(path, "w") as f:
    f.write(content)

print(f"SUCCESS: applied {changes} update(s) — Blood Bank added to the Clinical section, linking to /blood-bank.")
