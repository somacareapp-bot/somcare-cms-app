#!/bin/bash
#
# deploy_bedrent_persist.sh
# ─────────────────────────────────────────────────────────────────────────────
# Patches frontend/src/modules/billing/BedRentPage.tsx so the `stays` list
# (active charges + discharged history) is saved to localStorage and reloaded
# on mount. This is a stopgap until a real backend bed-charges endpoint
# exists — bed STATUS was always live (shared store), only the billing
# records were resetting on refresh.
# A backup is written before the file is touched.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "📁 Working directory: $(pwd)"

if [ ! -f "frontend/src/modules/billing/BedRentPage.tsx" ]; then
  echo "❌ Run this from the project root (the folder containing 'frontend/')."
  exit 1
fi

cat > /tmp/patch_bedrent_persist.py << 'PYEOF'
import os, shutil, datetime, sys

path = "frontend/src/modules/billing/BedRentPage.tsx"
with open(path) as f:
    content = f.read()

def rep(old, new, expected=1):
    global content
    n = content.count(old)
    if n != expected:
        print("ERROR: expected %d match(es), found %d for anchor:\n%s" % (expected, n, old[:100]))
        sys.exit(1)
    content = content.replace(old, new)

if "BED_RENT_STAYS_KEY" in content:
    print("Already patched — nothing to do.")
    sys.exit(0)

# a) storage key + load/save helpers, placed right after the money() helper
rep(
"""const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });""",
"""const money = (n: number) =>
  n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const BED_RENT_STAYS_KEY = 'somcare.bedRent.stays';

function loadStays(): Stay[] {
  try {
    const raw = localStorage.getItem(BED_RENT_STAYS_KEY);
    return raw ? (JSON.parse(raw) as Stay[]) : [];
  } catch {
    return [];
  }
}

function saveStays(stays: Stay[]) {
  try {
    localStorage.setItem(BED_RENT_STAYS_KEY, JSON.stringify(stays));
  } catch {
    // storage unavailable (private mode, quota) — charges stay in-memory only
  }
}""")

# b) initialise state from storage instead of empty array
rep(
"""  const [stays, setStays] = useState<Stay[]>([]);""",
"""  const [stays, setStays] = useState<Stay[]>(() => loadStays());""")

# c) write through on every change — insert useEffect after the useState block
rep(
"""  const [admittedOn, setAdmittedOn] = useState(todayStr());
  const [error, setError] = useState('');""",
"""  const [admittedOn, setAdmittedOn] = useState(todayStr());
  const [error, setError] = useState('');

  useEffect(() => {
    saveStays(stays);
  }, [stays]);""")

# d) import useEffect
rep(
"""import { useMemo, useState } from 'react';""",
"""import { useEffect, useMemo, useState } from 'react';""")

# e) footnote: stop telling the user charges are wiped on refresh
rep(
"""      <p className="text-xs text-gray-400">
        Bed status and patient assignment are saved to the shared beds store, so Bed Management
        reflects them immediately. Admission dates and totals are held in this page only and clear
        on refresh — they will persist once a bed-charges endpoint exists on the backend.
      </p>""",
"""      <p className="text-xs text-gray-400">
        Bed status and patient assignment are saved to the shared beds store, so Bed Management
        reflects them immediately. Admission dates and totals are saved to this browser, so they
        survive a refresh \u2014 they'll move to the server once a bed-charges endpoint exists on the
        backend.
      </p>""")

backup_dir = "frontend/src/modules/billing/.backups"
os.makedirs(backup_dir, exist_ok=True)
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy(path, backup_dir + "/BedRentPage.tsx." + ts + ".bak")

with open(path, "w") as f:
    f.write(content)

print("SUCCESS: BedRentPage.tsx now persists stays to localStorage.")
PYEOF

python3 /tmp/patch_bedrent_persist.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
grep -n "BED_RENT_STAYS_KEY\|loadStays\|saveStays\|useEffect" frontend/src/modules/billing/BedRentPage.tsx | head
echo ""
echo "🎉 Done. Restart the dev server and hard-refresh the browser:"
echo "   cd frontend && npm run dev"
