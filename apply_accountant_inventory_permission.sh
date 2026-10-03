#!/bin/bash
set -e

python3 << 'PYEOF'
import sys

path = "backend/src/database/seeds/initial-seed.ts"
OLD = (
    "      name: 'accountant',\n"
    "      displayName: 'Accountant',\n"
    "      permissions: getPerms('billing', 'payments', 'reports'),\n"
)
NEW = (
    "      name: 'accountant',\n"
    "      displayName: 'Accountant',\n"
    "      permissions: getPerms('billing', 'payments', 'reports', 'inventory', 'pharmacy'),\n"
)

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
count = content.count(OLD)
if count != 1:
    print(f"FAILED: expected 1 match, found {count}")
    sys.exit(1)
content = content.replace(OLD, NEW, 1)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f"Patched: {path}")
print("\nAccountant now seeds with inventory + pharmacy permissions (in addition to billing/payments/reports).")
print("Reminder: this only affects a FRESH seed run — see chat for how to check if a re-seed is safe on your existing DB.")
PYEOF
