path = "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx"
with open(path) as f:
    content = f.read()

# 1. Revert the sticky/overflow hacks — the portal approach below makes them unnecessary
content = content.replace(
    '<div className="bg-white rounded-xl border border-clinical-200 overflow-x-auto">',
    '<div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">',
    1,
)
content = content.replace(
    '<th className="px-4 py-3 sticky right-0 bg-clinical-50" />',
    '<th className="px-4 py-3" />',
    1,
)
content = content.replace(
    '<td className="px-4 py-3 sticky right-0 bg-white group-hover:bg-clinical-50">',
    '<td className="px-4 py-3">',
    1,
)
content = content.replace(
    '<tr key={p.id} className="group hover:bg-clinical-50 transition-colors">',
    '<tr key={p.id} className="hover:bg-clinical-50 transition-colors">',
    1,
)

# 2. Add createPortal import (skip if already present, e.g. if this file also needs it once)
if "import { createPortal } from 'react-dom';" not in content:
    anchor_import = "} from 'lucide-react';\n"
    if anchor_import not in content:
        raise SystemExit("import anchor not found")
    content = content.replace(anchor_import, anchor_import + "import { createPortal } from 'react-dom';\n", 1)

# 3. Add menuPos state next to openMenuId
anchor_state = "  const [openMenuId, setOpenMenuId] = useState<string | null>(null);\n"
if anchor_state not in content:
    raise SystemExit("state anchor not found")
if "menuPos" not in content:
    content = content.replace(
        anchor_state,
        anchor_state + "  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);\n",
        1,
    )

with open(path, "w") as f:
    f.write(content)
print("Step 1-3 done:", path)
