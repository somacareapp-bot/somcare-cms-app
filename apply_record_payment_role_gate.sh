#!/bin/bash
set -e

python3 << 'PYEOF'
import sys

OLD = (
    "                            {p.paymentStatus !== 'paid' && p.status !== 'cancelled' && (\n"
    "                              <button\n"
    "                                onClick={() => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); }}\n"
    '                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"\n'
    "                              >\n"
    "                                <CreditCard size={13} /> Record Payment\n"
    "                              </button>\n"
    "                            )}"
)
NEW = (
    "                            {(isAdmin || isAccountant) && p.paymentStatus !== 'paid' && p.status !== 'cancelled' && (\n"
    "                              <button\n"
    "                                onClick={() => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); }}\n"
    '                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"\n'
    "                              >\n"
    "                                <CreditCard size={13} /> Record Payment\n"
    "                              </button>\n"
    "                            )}"
)

for path in [
    "frontend/src/modules/pharmacy/PurchasesPage.tsx",
    "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx",
]:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(OLD)
    if count != 1:
        print(f"FAILED [{path}]: expected 1 match, found {count}. "
              f"(If you already hand-edited this button, the anchor text won't match — tell me what it looks like now.)")
        sys.exit(1)
    content = content.replace(OLD, NEW, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Patched: {path}")

print("\nRecord Payment is now admin/accountant only on both pages.")
PYEOF
