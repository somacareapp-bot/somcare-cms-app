paths = [
    "frontend/src/modules/pharmacy/PurchasesPage.tsx",
    "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx",
]

old = """                            {p.status === 'pending' && p.paymentStatus === 'paid' && (
                              <p className="px-3 py-2 text-[11px] text-clinical-400">Confirm receipt to close out</p>
                            )}"""

new = """                            {p.status === 'pending' && p.paymentStatus === 'paid' && (
                              <p className="px-3 py-2 text-[11px] text-clinical-400">Confirm receipt to close out</p>
                            )}
                            {!(p.status === 'pending') &&
                             !(isAdmin && p.approvalStatus === 'submitted') &&
                             !((isAccountant || isAdmin) && p.approvalStatus === 'admin_approved' && p.dueAmount === 0) &&
                             !(p.approvalStatus === 'admin_approved' && p.dueAmount > 0) &&
                             !((isAdmin || isAccountant) && p.paymentStatus !== 'paid' && p.status !== 'cancelled') &&
                             !(p.status === 'pending' && p.paymentStatus === 'paid') && (
                              <p className="px-3 py-2 text-[11px] text-clinical-400">No actions available</p>
                            )}"""

for path in paths:
    with open(path) as f:
        content = f.read()
    count = content.count(old)
    if count != 1:
        raise SystemExit(f"Expected exactly 1 match in {path}, found {count}")
    content = content.replace(old, new, 1)
    with open(path, "w") as f:
        f.write(content)
    print("Patched:", path)
