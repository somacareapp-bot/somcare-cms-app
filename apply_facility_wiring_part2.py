#!/usr/bin/env python3
"""
Part 2 of facility-settings wiring:
  - Adds a `facility` 6th parameter to generatePatientPDF()
  - Replaces the hardcoded SOMCARE name/logo/address/phone/email in the PDF
    header with real facility data (falling back to the old hardcoded
    values if nothing is set yet)
  - Adds facilityApi + loadImageAsBase64 imports to PatientDetailPage.tsx
  - Updates the "Download Full Report" click handler to fetch facility
    settings, convert the logo to base64, and pass it through

Run AFTER copying facility-settings.controller.ts into place:
  cp ~/Downloads/facility-settings.controller.ts "backend/src/settings/facility/"

Then from your project root (the "cms" folder):
  python3 apply_facility_wiring_part2.py
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
        die(f"{label}: anchor text not found in {path} (file may have changed since I last saw it — paste me its current content around that area)")
    count = text.count(old)
    if count != 1:
        die(f"{label}: anchor text appears {count} times in {path}, expected exactly 1")
    path.write_text(text.replace(old, new, 1))
    print(f"OK — {label}")

pdp = ROOT / "frontend/src/modules/patients/PatientDetailPage.tsx"

# ── 1. imports ────────────────────────────────────────────────────────────
patch(
    pdp,
    "import { patientsApi, visitsApi, usersApi, appointmentsApi, labApi, billingApi } from '../../services/api';",
    "import api, { patientsApi, visitsApi, usersApi, appointmentsApi, labApi, billingApi, facilityApi } from '../../services/api';",
    "imports: added default api export + facilityApi",
)
patch(
    pdp,
    "import { InvoiceModal, InvoiceSourceBadges } from '../billing/InvoicesPage';",
    "import { InvoiceModal, InvoiceSourceBadges } from '../billing/InvoicesPage';\nimport { loadImageAsBase64 } from '../settings/loadImageAsBase64';",
    "imports: added loadImageAsBase64",
)

# ── 2. generatePatientPDF signature ─────────────────────────────────────────
patch(
    pdp,
    "async function generatePatientPDF(\n"
    "  patient: any,\n"
    "  appointments: any[],\n"
    "  prescriptions: any[],\n"
    "  labOrders: any[],\n"
    "  invoices: any[],\n"
    ") {",
    "async function generatePatientPDF(\n"
    "  patient: any,\n"
    "  appointments: any[],\n"
    "  prescriptions: any[],\n"
    "  labOrders: any[],\n"
    "  invoices: any[],\n"
    "  facility: any = {},\n"
    ") {",
    "generatePatientPDF(): added facility parameter",
)

# ── 3. header block: real logo + facility name/address/phone/email ─────────
patch(
    pdp,
    "    y = 10;\n"
    "    drawLogo(mg + 6, y + 3, 6);\n"
    "\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);\n"
    "    doc.setTextColor(...dark); doc.text('SOM', mg + 16, y + 6);\n"
    "    const somW = doc.getTextWidth('SOM');\n"
    "    doc.setTextColor(...brand); doc.text('CARE', mg + 16 + somW, y + 6);\n"
    "\n"
    "    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);\n"
    "    doc.setTextColor(70, 70, 70);\n"
    "    doc.text('CLINICAL MANAGEMENT SYSTEM', mg + 16, y + 10);\n"
    "\n"
    "    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);\n"
    "    doc.setTextColor(...brand);\n"
    "    doc.text('Better Care  \\u2022  Healthier Tomorrow', mg + 16, y + 14);\n"
    "\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);\n"
    "    doc.setTextColor(...dark);\n"
    "    doc.text('SOMCARE Medical Center', pw - mg, y, { align: 'right' });\n"
    "    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);\n"
    "    doc.setTextColor(...mid);\n"
    "    doc.text('Hargeisa, Woqooyi Galbeed, Somaliland', pw - mg, y + 4.5, { align: 'right' });\n"
    "    doc.text('+252 63 0000000', pw - mg, y + 9, { align: 'right' });\n"
    "    doc.text('info@somcare.com', pw - mg, y + 13.5, { align: 'right' });",

    "    y = 10;\n"
    "    const logoData: string | undefined = facility?.logoBase64;\n"
    "    const logoIsRaster = typeof logoData === 'string' && /^data:image\\/(png|jpe?g)/i.test(logoData);\n"
    "    if (logoIsRaster) {\n"
    "      try {\n"
    "        const fmt = /data:image\\/png/i.test(logoData!) ? 'PNG' : 'JPEG';\n"
    "        doc.addImage(logoData!, fmt, mg, y - 3, 12, 12);\n"
    "      } catch {\n"
    "        drawLogo(mg + 6, y + 3, 6);\n"
    "      }\n"
    "    } else {\n"
    "      drawLogo(mg + 6, y + 3, 6);\n"
    "    }\n"
    "\n"
    "    const facilityName: string = facility?.name || 'SOMCARE Medical Center';\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);\n"
    "    doc.setTextColor(...dark); doc.text(facilityName, mg + 16, y + 6);\n"
    "\n"
    "    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);\n"
    "    doc.setTextColor(70, 70, 70);\n"
    "    doc.text('CLINICAL MANAGEMENT SYSTEM', mg + 16, y + 10);\n"
    "\n"
    "    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);\n"
    "    doc.setTextColor(...brand);\n"
    "    doc.text(facility?.tagline || 'Better Care  \\u2022  Healthier Tomorrow', mg + 16, y + 14);\n"
    "\n"
    "    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);\n"
    "    doc.setTextColor(...dark);\n"
    "    doc.text(facilityName, pw - mg, y, { align: 'right' });\n"
    "    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);\n"
    "    doc.setTextColor(...mid);\n"
    "    doc.text(facility?.address || 'Hargeisa, Woqooyi Galbeed, Somaliland', pw - mg, y + 4.5, { align: 'right' });\n"
    "    doc.text(facility?.phone || '+252 63 0000000', pw - mg, y + 9, { align: 'right' });\n"
    "    doc.text(facility?.email || 'info@somcare.com', pw - mg, y + 13.5, { align: 'right' });",

    "PDF header: real facility name/logo/address/phone/email wired in",
)

# ── 4. call site: fetch facility + logo, pass through ───────────────────────
patch(
    pdp,
    "              setPdfLoading(true);\n"
    "              try {\n"
    "                const [freshLabOrders, freshInvoices] = await Promise.all([\n"
    "                  labApi.getAll(undefined, id).then((res) => res.data),\n"
    "                  billingApi.getAll(id).then((res) => res.data),\n"
    "                ]);\n"
    "                await generatePatientPDF(patient, visitsWithRx ?? [], prescriptions ?? [], freshLabOrders ?? [], freshInvoices ?? []);",

    "              setPdfLoading(true);\n"
    "              try {\n"
    "                const [freshLabOrders, freshInvoices, facilitySettings] = await Promise.all([\n"
    "                  labApi.getAll(undefined, id).then((res) => res.data),\n"
    "                  billingApi.getAll(id).then((res) => res.data),\n"
    "                  facilityApi.get().then((res) => res.data).catch(() => null),\n"
    "                ]);\n"
    "                const logoAbsoluteUrl = facilitySettings?.logoUrl\n"
    "                  ? `${api.defaults.baseURL}${facilitySettings.logoUrl}`\n"
    "                  : undefined;\n"
    "                const logoBase64 = await loadImageAsBase64(logoAbsoluteUrl);\n"
    "                await generatePatientPDF(\n"
    "                  patient,\n"
    "                  visitsWithRx ?? [],\n"
    "                  prescriptions ?? [],\n"
    "                  freshLabOrders ?? [],\n"
    "                  freshInvoices ?? [],\n"
    "                  { ...(facilitySettings ?? {}), logoBase64 },\n"
    "                );",

    "Download button: fetches facility settings + converts logo before generating PDF",
)

print("\nALL PART 2 PATCHES APPLIED SUCCESSFULLY.")
print("Note: the two-tone SOM/CARE wordmark is gone — the facility name now renders")
print("as a single dark-colored string, since it won't always split into two words.")
print("Note: SVG/WEBP logos fall back to the vector mark in the PDF — jsPDF's addImage")
print("only supports PNG/JPEG reliably. PNG or JPG logo uploads will render for real.")
