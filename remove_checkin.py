"""
remove_checkin.py
Removes the doctor-select, urgency-select, and Check In button
from PatientDetailPage.tsx by finding each element individually.
"""
import re, sys
from pathlib import Path

TARGET = Path(__file__).parent / "frontend/src/modules/patients/PatientDetailPage.tsx"

if not TARGET.exists():
    sys.exit(f"ERROR: cannot find {TARGET}")

src = TARGET.read_text(encoding="utf-8")
original = src

# ── 1. Remove doctor <select> block ─────────────────────────────────────────
src, n = re.subn(
    r'<select\b[^>]*value=\{doctorId\}[^>]*>.*?</select>',
    '', src, flags=re.DOTALL
)
print(f"{'OK' if n else 'WARN'} — doctor select {'removed' if n else 'NOT FOUND'}")

# ── 2. Remove urgency <select> block ────────────────────────────────────────
src, n = re.subn(
    r'<select\b[^>]*value=\{urgency\}[^>]*>.*?</select>',
    '', src, flags=re.DOTALL
)
print(f"{'OK' if n else 'WARN'} — urgency select {'removed' if n else 'NOT FOUND'}")

# ── 3. Remove Check In <button> ─────────────────────────────────────────────
src, n = re.subn(
    r'<button\b[^>]*checkInMutation\.mutate[^>]*>.*?</button>',
    '', src, flags=re.DOTALL
)
print(f"{'OK' if n else 'WARN'} — Check In button {'removed' if n else 'NOT FOUND'}")

# ── 4. Remove the checkInMutation.isError error paragraph ───────────────────
src, n = re.subn(
    r'\{checkInMutation\.isError\b.*?</p>\s*\}',
    '', src, flags=re.DOTALL
)
print(f"{'OK' if n else 'SKIP'} — error paragraph {'removed' if n else 'not found (ok)'}")

# ── 5. Remove LogIn from lucide import ──────────────────────────────────────
src, n = re.subn(r',?\s*LogIn\b', '', src)
print(f"{'OK' if n else 'SKIP'} — LogIn import {'removed' if n else 'already gone'}")

# ── 6. Collapse any wrapper divs left empty by the removal ──────────────────
# e.g.  <div className="flex items-center gap-3">\n          \n        </div>
src = re.sub(r'<div[^>]*>\s*</div>', '', src)

# ── Write back ───────────────────────────────────────────────────────────────
backup = TARGET.with_suffix('.tsx.bak2')
backup.write_text(original, encoding='utf-8')
TARGET.write_text(src, encoding='utf-8')
print(f"\nSUCCESS — saved. Backup → {backup.name}")
print("Restart the dev server if it doesn't hot-reload.")
