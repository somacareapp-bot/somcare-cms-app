#!/bin/bash
#
# deploy_bedrent_excel.sh
# ─────────────────────────────────────────────────────────────────────────────
# 1. Installs the `xlsx` package in frontend/ (skipped if already present).
# 2. Patches frontend/src/modules/billing/BedRentPage.tsx to add a
#    "Download Excel" button on the Discharged table that exports a full
#    bed-rent report (per-stay rows + a totals row + a summary sheet).
# A backup is written before the file is touched.
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo "📁 Working directory: $(pwd)"

if [ ! -f "frontend/src/modules/billing/BedRentPage.tsx" ]; then
  echo "❌ Run this from the project root (the folder containing 'frontend/')."
  exit 1
fi

# ─── 1. Dependency ───────────────────────────────────────────────────────────
if [ -d "frontend/node_modules/xlsx" ]; then
  echo "✅ xlsx already installed — skipping npm install"
else
  echo "📦 Installing xlsx…"
  (cd frontend && npm install xlsx)
  echo "✅ xlsx installed"
fi

# ─── 2. Patch the page ───────────────────────────────────────────────────────
cat > /tmp/patch_bedrent_excel.py << 'PYEOF'
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

if "exportDischargedToExcel" in content:
    print("Already patched — nothing to do.")
    sys.exit(0)

# a) import the library
rep(
"""import * as D from '../../stores/settingsData';""",
"""import * as XLSX from 'xlsx';
import * as D from '../../stores/settingsData';""")

# b) the export function, inserted just above the render helpers
rep(
"""  /* \u2500\u2500\u2500 Render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */""",
"""  function exportDischargedToExcel() {
    if (dischargedStays.length === 0) return;

    const rows = dischargedStays.map((s) => {
      const nights = nightsBetween(s.admittedOn, s.dischargedOn as string);
      return {
        'Patient': s.patientName,
        'Patient code': s.patientCode || '',
        'Bed': s.bedNumber,
        'Ward': s.wardName,
        'Admitted on': s.admittedOn,
        'Discharged on': s.dischargedOn as string,
        'Nights': nights,
        'Daily rate': Number((s.dailyRate ?? 0).toFixed(2)),
        'Total charged': Number((s.dailyRate * nights).toFixed(2)),
      };
    });

    const totalNights = rows.reduce((sum, r) => sum + r['Nights'], 0);
    const totalCharged = rows.reduce((sum, r) => sum + r['Total charged'], 0);

    rows.push({
      'Patient': 'TOTAL',
      'Patient code': '',
      'Bed': '',
      'Ward': '',
      'Admitted on': '',
      'Discharged on': '',
      'Nights': totalNights,
      'Daily rate': '' as unknown as number,
      'Total charged': Number(totalCharged.toFixed(2)),
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
      { wch: 26 }, { wch: 16 }, { wch: 12 }, { wch: 22 },
      { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
    ];

    const summary = XLSX.utils.json_to_sheet([
      { Field: 'Report', Value: 'Bed rent \u2014 discharged stays' },
      { Field: 'Generated on', Value: todayStr() },
      { Field: 'Discharged stays', Value: dischargedStays.length },
      { Field: 'Total nights billed', Value: totalNights },
      { Field: 'Total charged', Value: Number(totalCharged.toFixed(2)) },
      { Field: 'Beds occupied now', Value: occupiedBeds.length },
      { Field: 'Beds available now', Value: availableBeds.length },
    ]);
    summary['!cols'] = [{ wch: 24 }, { wch: 30 }];

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Discharged stays');
    XLSX.utils.book_append_sheet(book, summary, 'Summary');
    XLSX.writeFile(book, `bed-rent-discharged-${todayStr()}.xlsx`);
  }

  /* \u2500\u2500\u2500 Render \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */""")

# c) header of the Discharged card gains the button
rep(
"""          <div className="border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Discharged</h2>
          </div>""",
"""          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
            <h2 className="text-base font-semibold text-gray-900">Discharged</h2>
            <button
              onClick={exportDischargedToExcel}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Download Excel
            </button>
          </div>""")

backup_dir = "frontend/src/modules/billing/.backups"
os.makedirs(backup_dir, exist_ok=True)
ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
shutil.copy(path, backup_dir + "/BedRentPage.tsx." + ts + ".bak")

with open(path, "w") as f:
    f.write(content)

print("SUCCESS: BedRentPage.tsx now exports discharged stays to Excel.")
PYEOF

python3 /tmp/patch_bedrent_excel.py

echo ""
echo "── Verification ─────────────────────────────────────────────────────────"
grep -n "xlsx\|exportDischargedToExcel\|Download Excel" frontend/src/modules/billing/BedRentPage.tsx | head
echo ""
echo "🎉 Done. Restart the dev server (Vite needs it for the new dep):"
echo "   cd frontend && npm run dev"
