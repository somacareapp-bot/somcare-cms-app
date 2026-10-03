"""
fix_consultation_complete.py
Moves the consultationComplete + pdfLoading declarations
inside the component function, right before the return statement.
"""
import re
from pathlib import Path

TARGET = Path(__file__).parent / "frontend/src/modules/patients/PatientDetailPage.tsx"
src = TARGET.read_text(encoding="utf-8")
original = src

# ── 1. Remove wherever the bad injection landed (outside the component) ──────
src = re.sub(
    r'\s*const \[pdfLoading, setPdfLoading\] = useState<boolean>\(false\);.*?'
    r'const consultationComplete = \(appointments \?\? \[\]\)\.some\(\s*\(a: any\) => a\.status === \'completed\'\s*\);',
    '', src, flags=re.DOTALL
)
# Also catch variant without <boolean>
src = re.sub(
    r'\s*const \[pdfLoading, setPdfLoading\] = useState\(false\);.*?'
    r'const consultationComplete = \(appointments \?\? \[\]\)\.some\(\s*\(a: any\) => a\.status === \'completed\'\s*\);',
    '', src, flags=re.DOTALL
)

print("OK  — removed stale injection")

# ── 2. Find the last useState/useQuery/useMutation inside the main component
#       by looking for a known state line that IS inside the component, then
#       append our two declarations right after it. ────────────────────────────
ANCHOR = "const [viewingInvoice, setViewingInvoice] = useState<any>(null);"
INSERT = """
  const [pdfLoading, setPdfLoading] = useState(false);
  const consultationComplete = (appointments ?? []).some(
    (a: any) => a.status === 'completed'
  );"""

if ANCHOR in src:
    src = src.replace(ANCHOR, ANCHOR + INSERT, 1)
    print("OK  — declarations inserted after viewingInvoice state")
else:
    # Fallback: insert just before the return (
    src = re.sub(
        r'(\n  return \()',
        INSERT + r'\1',
        src, count=1
    )
    print("OK  — declarations inserted before return (fallback)")

# ── Write back ───────────────────────────────────────────────────────────────
TARGET.with_suffix('.tsx.bak4').write_text(original, encoding='utf-8')
TARGET.write_text(src, encoding='utf-8')
print("SUCCESS — PatientDetailPage.tsx fixed. Refresh the browser.")
