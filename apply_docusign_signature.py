#!/usr/bin/env python3
"""
Renders a real cursive signature (Sacramento font) above the "Approved and
Verified by" line in approvalBlock(), DocuSign-style, instead of plain text.
Falls back to an italic "Not yet signed" when no name is available yet.

Run from your project root (the "cms" folder), AFTER copying signatureFont.ts
into frontend/src/modules/patients/ (you already did this).
"""
from pathlib import Path
import sys

ROOT = Path(".")

def die(msg):
    print(f"FAILED — {msg}")
    sys.exit(1)

def patch(path: Path, old: str, new: str, label: str):
    if not path.exists():
        die(f"{path} not found")
    text = path.read_text()
    if old not in text:
        die(f"{label}: anchor text not found in {path} (paste me its current content around that area)")
    count = text.count(old)
    if count != 1:
        die(f"{label}: anchor text appears {count} times in {path}, expected exactly 1")
    path.write_text(text.replace(old, new, 1))
    print(f"OK — {label}")

pdp = ROOT / "frontend/src/modules/patients/PatientDetailPage.tsx"

# ── import ────────────────────────────────────────────────────────────────
patch(
    pdp,
    "import { loadImageAsBase64 } from '../settings/loadImageAsBase64';",
    "import { loadImageAsBase64 } from '../settings/loadImageAsBase64';\nimport { registerSignatureFont } from './signatureFont';",
    "import: registerSignatureFont added",
)

# ── approvalBlock() ──────────────────────────────────────────────────────
patch(
    pdp,
    "  function approvalBlock(sectionTitle: string, role: string, name?: string) {\n"
    "    chk(sectionTitle, 26);\n"
    "    y += 6;\n"
    "    doc.setDrawColor(...mid); doc.setLineWidth(0.3);\n"
    "    doc.line(mg, y, mg + 75, y);\n"
    "    doc.line(pw - mg - 55, y, pw - mg, y);\n"
    "\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);\n"
    "    doc.text('Approved and Verified by', mg, y + 5);\n"
    "    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);\n"
    "    doc.text(name ?? '\\u2014', mg, y + 9.5);\n"
    "    doc.text(role, mg, y + 13.5);\n"
    "\n"
    "    const now = new Date();\n"
    "    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });\n"
    "    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);\n"
    "    doc.text('Date', pw - mg - 55, y + 5);\n"
    "    doc.text('Time', pw - mg - 22, y + 5);\n"
    "    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mid);\n"
    "    doc.text(dateStr, pw - mg - 55, y + 9.5);\n"
    "    doc.text(timeStr, pw - mg - 22, y + 9.5);\n"
    "\n"
    "    y += 18;\n"
    "  }",

    "  function approvalBlock(sectionTitle: string, role: string, name?: string) {\n"
    "    chk(sectionTitle, 32);\n"
    "    y += 10;\n"
    "\n"
    "    if (name) {\n"
    "      registerSignatureFont(doc);\n"
    "      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...mid);\n"
    "      doc.text('DocuSigned by', mg + 1, y - 5);\n"
    "      doc.setFont('Sacramento', 'normal'); doc.setFontSize(16); doc.setTextColor(...brand);\n"
    "      doc.text(name, mg + 1, y);\n"
    "    } else {\n"
    "      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...mid);\n"
    "      doc.text('Not yet signed', mg + 1, y);\n"
    "    }\n"
    "\n"
    "    doc.setDrawColor(...mid); doc.setLineWidth(0.3);\n"
    "    doc.line(mg, y + 3, mg + 75, y + 3);\n"
    "    doc.line(pw - mg - 55, y + 3, pw - mg, y + 3);\n"
    "\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);\n"
    "    doc.text('Approved and Verified by', mg, y + 8);\n"
    "    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);\n"
    "    doc.text(role, mg, y + 12);\n"
    "\n"
    "    const now = new Date();\n"
    "    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });\n"
    "    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);\n"
    "    doc.text('Date', pw - mg - 55, y + 8);\n"
    "    doc.text('Time', pw - mg - 22, y + 8);\n"
    "    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mid);\n"
    "    doc.text(dateStr, pw - mg - 55, y + 12);\n"
    "    doc.text(timeStr, pw - mg - 22, y + 12);\n"
    "\n"
    "    y += 20;\n"
    "  }",

    "approvalBlock(): real cursive Sacramento signature wired in",
)

print("\nALL PATCHES APPLIED SUCCESSFULLY.")
print("Only the Clinical/Doctor section has a real name to sign with right now")
print("(visit.doctorName) — Lab/Pharmacy/Reception will show 'Not yet signed'")
print("until the name-tracking backend work is done (see my next message).")
