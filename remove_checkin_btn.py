"""
remove_checkin_btn.py — removes the Check In button by matching on
the visible text 'Check In' instead of the onClick attribute.
"""
import re
from pathlib import Path

TARGET = Path(__file__).parent / "frontend/src/modules/patients/PatientDetailPage.tsx"
src = TARGET.read_text(encoding="utf-8")
original = src

# Match any <button ...> block that contains the text "Check In"
src, n = re.subn(
    r'<button\b[^>]*>(?:[^<]|<(?!/?button))*?Check\s+In(?:[^<]|<(?!/?button))*?</button>',
    '', src, flags=re.DOTALL
)
print(f"{'OK' if n else 'WARN'} — Check In button {'removed' if n else 'NOT FOUND'}")

# Clean up any empty wrapper divs left behind
src = re.sub(r'<div[^>]*>\s*</div>', '', src)

TARGET.with_suffix('.tsx.bak3').write_text(original, encoding='utf-8')
TARGET.write_text(src, encoding='utf-8')
print("SUCCESS — saved.")
