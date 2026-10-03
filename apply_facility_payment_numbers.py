#!/usr/bin/env python3
"""
Adds E-Dahab / Zaad / Account payment numbers:
  - to the Facility Information form in SettingsPage.tsx
  - to the PDF header (right side, under address/phone/email)

Run AFTER copying the updated entity + DTO into place:
  cp ~/Downloads/facility-settings.entity.ts "backend/src/settings/facility/entities/"
  cp ~/Downloads/update-facility-settings.dto.ts "backend/src/settings/facility/dto/"

Then from your project root (the "cms" folder):
  python3 apply_facility_payment_numbers.py
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

# ── SettingsPage.tsx ─────────────────────────────────────────────────────
settings_page = ROOT / "frontend/src/modules/settings/SettingsPage.tsx"

patch(
    settings_page,
    "  if (settings && !initialized) {\n"
    "    setForm({\n"
    "      name: settings.name ?? '',\n"
    "      tagline: settings.tagline ?? '',\n"
    "      address: settings.address ?? '',\n"
    "      phone: settings.phone ?? '',\n"
    "      email: settings.email ?? '',\n"
    "    });\n"
    "    setInitialized(true);\n"
    "  }",
    "  if (settings && !initialized) {\n"
    "    setForm({\n"
    "      name: settings.name ?? '',\n"
    "      tagline: settings.tagline ?? '',\n"
    "      address: settings.address ?? '',\n"
    "      phone: settings.phone ?? '',\n"
    "      email: settings.email ?? '',\n"
    "      eDahabNumber: settings.eDahabNumber ?? '',\n"
    "      zaadNumber: settings.zaadNumber ?? '',\n"
    "      accountNumber: settings.accountNumber ?? '',\n"
    "    });\n"
    "    setInitialized(true);\n"
    "  }",
    "SettingsPage.tsx: initial load includes payment numbers",
)

patch(
    settings_page,
    "  const resetForm = () => settings && setForm({\n"
    "    name: settings.name ?? '',\n"
    "    tagline: settings.tagline ?? '',\n"
    "    address: settings.address ?? '',\n"
    "    phone: settings.phone ?? '',\n"
    "    email: settings.email ?? '',\n"
    "  });",
    "  const resetForm = () => settings && setForm({\n"
    "    name: settings.name ?? '',\n"
    "    tagline: settings.tagline ?? '',\n"
    "    address: settings.address ?? '',\n"
    "    phone: settings.phone ?? '',\n"
    "    email: settings.email ?? '',\n"
    "    eDahabNumber: settings.eDahabNumber ?? '',\n"
    "    zaadNumber: settings.zaadNumber ?? '',\n"
    "    accountNumber: settings.accountNumber ?? '',\n"
    "  });",
    "SettingsPage.tsx: reset includes payment numbers",
)

patch(
    settings_page,
    "        <Field label=\"Phone\"><TextInput value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>\n"
    "        <Field label=\"Email\"><TextInput type=\"email\" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>\n"
    "      </FieldGrid>",
    "        <Field label=\"Phone\"><TextInput value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>\n"
    "        <Field label=\"Email\"><TextInput type=\"email\" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>\n"
    "        <Field label=\"E-Dahab Number\"><TextInput value={form.eDahabNumber ?? ''} onChange={(e) => setForm({ ...form, eDahabNumber: e.target.value })} /></Field>\n"
    "        <Field label=\"Zaad Number\"><TextInput value={form.zaadNumber ?? ''} onChange={(e) => setForm({ ...form, zaadNumber: e.target.value })} /></Field>\n"
    "        <Field label=\"Account Number\"><TextInput value={form.accountNumber ?? ''} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} /></Field>\n"
    "      </FieldGrid>",
    "SettingsPage.tsx: three payment number fields added to form",
)

# ── PatientDetailPage.tsx: PDF header ────────────────────────────────────
pdp = ROOT / "frontend/src/modules/patients/PatientDetailPage.tsx"

patch(
    pdp,
    "    doc.text(facility?.address || 'Hargeisa, Woqooyi Galbeed, Somaliland', pw - mg, y + 4.5, { align: 'right' });\n"
    "    doc.text(facility?.phone || '+252 63 0000000', pw - mg, y + 9, { align: 'right' });\n"
    "    doc.text(facility?.email || 'info@somcare.com', pw - mg, y + 13.5, { align: 'right' });\n"
    "\n"
    "    y += 20;\n"
    "    doc.setDrawColor(...brand); doc.setLineWidth(0.6);\n"
    "    doc.line(0, y, pw, y);",

    "    doc.text(facility?.address || 'Hargeisa, Woqooyi Galbeed, Somaliland', pw - mg, y + 4.5, { align: 'right' });\n"
    "    doc.text(facility?.phone || '+252 63 0000000', pw - mg, y + 9, { align: 'right' });\n"
    "    doc.text(facility?.email || 'info@somcare.com', pw - mg, y + 13.5, { align: 'right' });\n"
    "\n"
    "    const paymentParts: string[] = [];\n"
    "    if (facility?.eDahabNumber) paymentParts.push(`E-Dahab: ${facility.eDahabNumber}`);\n"
    "    if (facility?.zaadNumber) paymentParts.push(`Zaad: ${facility.zaadNumber}`);\n"
    "    if (facility?.accountNumber) paymentParts.push(`Acc: ${facility.accountNumber}`);\n"
    "    if (paymentParts.length) {\n"
    "      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);\n"
    "      doc.setTextColor(...brand);\n"
    "      doc.text(paymentParts.join('   \\u2022   '), pw - mg, y + 18, { align: 'right' });\n"
    "    }\n"
    "\n"
    "    y += 24;\n"
    "    doc.setDrawColor(...brand); doc.setLineWidth(0.6);\n"
    "    doc.line(0, y, pw, y);",

    "PatientDetailPage.tsx: payment numbers rendered in PDF header",
)

print("\nALL PATCHES APPLIED SUCCESSFULLY.")
print("Payment numbers only print on the PDF if you've filled them in — empty ones are skipped.")
