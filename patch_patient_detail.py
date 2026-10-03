"""
patch_patient_detail.py
Run from anywhere:
  python3 patch_patient_detail.py

What it does to PatientDetailPage.tsx:
  1. Adds jsPDF + autoTable imports (cdn-loaded at runtime via a tiny helper)
  2. Adds a generatePDF() helper function
  3. Removes the doctor-dropdown / urgency-dropdown / Check-In button block
  4. Adds a "Download Full Report" button that appears when any appointment
     for this patient has status === 'completed'
"""

import re, sys, textwrap
from pathlib import Path

TARGET = Path(__file__).parent / "frontend/src/modules/patients/PatientDetailPage.tsx"

if not TARGET.exists():
    sys.exit(f"ERROR: cannot find {TARGET}\nRun this script from the cms/ folder.")

src = TARGET.read_text(encoding="utf-8")
original = src          # keep for rollback

# ──────────────────────────────────────────────────────────────────────────────
# 1.  Add FileDown to the lucide import (used for the button icon)
# ──────────────────────────────────────────────────────────────────────────────
src = src.replace(
    "import { ArrowLeft, Loader2, Phone, MapPin, Droplet, LogIn, Calendar, Pill, FlaskConical, Receipt, Eye }",
    "import { ArrowLeft, Loader2, Phone, MapPin, Droplet, Calendar, Pill, FlaskConical, Receipt, Eye, FileDown }"
)

# ──────────────────────────────────────────────────────────────────────────────
# 2.  Remove urgencyOptions (no longer needed in this file — still used inside
#     the appointment-creation modal if you have one, but not for check-in)
# ──────────────────────────────────────────────────────────────────────────────
src = re.sub(
    r"const urgencyOptions = \[\s+.*?\];",
    "// urgencyOptions removed — check-in flow moved to Appointments tab",
    src,
    flags=re.DOTALL,
)

# ──────────────────────────────────────────────────────────────────────────────
# 3.  Insert generatePDF helper just before `function PrescriptionsTab`
# ──────────────────────────────────────────────────────────────────────────────
PDF_HELPER = r"""
// ── PDF report generator (loads jsPDF from CDN on first call) ───────────────
async function generatePatientPDF(patient: any, appointments: any[], prescriptions: any[], labs: any[], invoices: any[]) {
  // Lazy-load jsPDF + autoTable from CDN so no extra npm dep is needed
  if (!(window as any).jspdf) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const mg = 18, cw = pw - mg * 2;
  let y = mg;
  const brand = [220, 38, 38] as [number, number, number];
  const dark  = [30,  30,  30] as [number, number, number];
  const mid   = [110, 110, 110] as [number, number, number];

  const secTitle = (t: string) => {
    y += 5;
    doc.setFillColor(...brand); doc.rect(mg, y, cw, 7, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    doc.text(t.toUpperCase(), mg + 3, y + 5);
    y += 11; doc.setTextColor(...dark);
  };
  const row = (lbl: string, val: string | number | null | undefined) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    doc.setTextColor(...mid); doc.text(lbl, mg + 2, y);
    doc.setTextColor(...dark); doc.text(String(val ?? '—'), mg + 60, y);
    y += 6;
  };
  const chk = (need = 20) => {
    if (y + need > doc.internal.pageSize.getHeight() - mg) { doc.addPage(); y = mg; }
  };

  // Header bar
  doc.setFillColor(...brand); doc.rect(0, 0, pw, 22, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 255, 255);
  doc.text('Clinical Management System', mg, 10);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text('Patient Consultation Report', mg, 17);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`,
    pw - mg, 17, { align: 'right' });
  y = 30;

  // Identity
  doc.setFillColor(246, 246, 246); doc.roundedRect(mg, y, cw, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...dark);
  doc.text(`${patient.firstName} ${patient.lastName}`, mg + 4, y + 8);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...mid);
  doc.text(`${patient.patientNumber ?? ''}  ·  ${patient.status ?? 'Active'}  ·  Outpatient`, mg + 4, y + 14);
  y += 24;

  // 1. Personal
  secTitle('1. Personal Information');
  const age = patient.dateOfBirth ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.156e10) : null;
  row('Age / Gender', age ? `${age}y · ${patient.gender ?? ''}` : patient.gender ?? '—');
  row('Blood Group',  patient.bloodGroup ?? '—');
  row('Phone',        patient.phone ?? '—');
  row('Location',     [patient.city, patient.country].filter(Boolean).join(', ') || '—');

  // 2. Medical
  chk(35); secTitle('2. Medical Information');
  row('Allergies',         patient.allergies ?? 'None recorded');
  row('Insurance',         patient.insurance ?? '—');
  row('Emergency Contact', patient.emergencyContact
    ? `${patient.emergencyContact}${patient.emergencyPhone ? ` (${patient.emergencyPhone})` : ''}`
    : '—');

  // 3. Lab Results
  chk(45); secTitle('3. Lab Results');
  if (labs?.length) {
    (doc as any).autoTable({
      startY: y, margin: { left: mg, right: mg },
      head: [['Test', 'Result', 'Normal Range', 'Date', 'Status']],
      body: labs.map((r: any) => [
        r.testName ?? r.name ?? '—',
        r.result ?? '—',
        r.normalRange ?? r.range ?? '—',
        r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—',
        r.status ?? '—',
      ]),
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No lab results recorded.', mg + 2, y); y += 8;
  }

  // 4. Prescriptions
  chk(45); secTitle('4. Prescriptions');
  if (prescriptions?.length) {
    (doc as any).autoTable({
      startY: y, margin: { left: mg, right: mg },
      head: [['Medication', 'Dosage', 'Frequency', 'Duration', 'Status']],
      body: prescriptions.map((p: any) => [
        p.medicineName ?? p.medicine?.name ?? '—',
        p.dosage ?? '—',
        p.frequency ?? '—',
        p.duration ?? '—',
        p.status ?? '—',
      ]),
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No prescriptions recorded.', mg + 2, y); y += 8;
  }

  // 5. Invoices
  chk(45); secTitle('5. Invoices');
  if (invoices?.length) {
    (doc as any).autoTable({
      startY: y, margin: { left: mg, right: mg },
      head: [['Invoice #', 'Date', 'Total', 'Paid', 'Due', 'Status']],
      body: invoices.map((i: any) => [
        i.invoiceNumber ?? i.id?.slice(0, 8) ?? '—',
        i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '—',
        `$${Number(i.total ?? 0).toFixed(2)}`,
        `$${Number(i.paid ?? 0).toFixed(2)}`,
        `$${(Number(i.total ?? 0) - Number(i.paid ?? 0)).toFixed(2)}`,
        i.status ?? '—',
      ]),
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No invoices recorded.', mg + 2, y);
  }

  // Footer on every page
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 220, 220);
    doc.line(mg, doc.internal.pageSize.getHeight() - 12, pw - mg, doc.internal.pageSize.getHeight() - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...mid);
    doc.text('Confidential — for authorised personnel only.', mg, doc.internal.pageSize.getHeight() - 7);
    doc.text(`Page ${i} of ${total}`, pw - mg, doc.internal.pageSize.getHeight() - 7, { align: 'right' });
  }

  const pid = patient.patientNumber ?? patient.id?.slice(0, 8) ?? 'patient';
  doc.save(`${pid}_consultation_report.pdf`);
}
// ────────────────────────────────────────────────────────────────────────────
"""

ANCHOR = "function PrescriptionsTab("
if ANCHOR in src:
    src = src.replace(ANCHOR, PDF_HELPER + ANCHOR)
    print("OK  — generatePatientPDF helper inserted")
else:
    print("WARN — could not find 'function PrescriptionsTab(' — insert helper manually")

# ──────────────────────────────────────────────────────────────────────────────
# 4.  Remove the check-in block (doctor select + urgency select + Check In btn)
#     The block runs from the opening <div> that wraps the selects to its
#     closing </div>, then the optional error <p>.
#
#     From the grep output the structure is:
#       <select value={doctorId} ...>   ... </select>
#       <select value={urgency} ...>    ... </select>
#       <button onClick={checkInMutation.mutate} ...> Check In </button>
#     wrapped in two nested divs, followed by the error <p>.
#
#     We match from the outer wrapper that contains "Select doctor…" through
#     the closing error paragraph.
# ──────────────────────────────────────────────────────────────────────────────
CHECKIN_PATTERN = re.compile(
    r'<select\s[^>]*?value=\{doctorId\}.*?</select>\s*'   # doctor select
    r'<select\s[^>]*?value=\{urgency\}.*?</select>\s*'     # urgency select
    r'<button[^>]*?checkInMutation\.mutate[^>]*?>.*?</button>',
    re.DOTALL
)

if CHECKIN_PATTERN.search(src):
    src = CHECKIN_PATTERN.sub("", src)
    print("OK  — doctor/urgency/check-in controls removed")
else:
    print("WARN — check-in pattern not found; remove the three controls manually")

# Also remove the wrapping div + error paragraph if they are now empty.
# Pattern: <div className="flex items-center gap-3"> … </div> (the inner flex row)
# after the removal the outer wrapper may be: <div>↵      </div>
src = re.sub(r'<div[^>]*>\s*</div>\s*\{checkInMutation\.isError &&.*?</p>\s*\}', "",
             src, flags=re.DOTALL)
# Simpler fallback: remove orphaned error line
src = re.sub(r'\{checkInMutation\.isError &&.*?</p>\s*\}', "", src, flags=re.DOTALL)

# ──────────────────────────────────────────────────────────────────────────────
# 5.  Add useState for pdfLoading and a consultationComplete derived variable,
#     and replace the removed block with the Download Report button.
#
#     We inject right after the line that declares `checkInMutation` (or any
#     nearby state line). Find the last useState / useMutation before the
#     return statement and append after it.
#
#     Strategy: find "const [viewingInvoice" (added by earlier script) and
#     insert our new state + button JSX after the check-in block's parent div.
# ──────────────────────────────────────────────────────────────────────────────

# Add pdfLoading state after the last useState in the component body
# We look for the viewingInvoice state line added by the earlier script
VIEWING_STATE = "const [viewingInvoice, setViewingInvoice] = useState<any>(null);"
PDF_STATE = """const [pdfLoading, setPdfLoading] = useState(false);

  // "Download Full Report" is available when at least one appointment is complete
  const consultationComplete = (appointments ?? []).some(
    (a: any) => a.status === 'completed'
  );"""

if VIEWING_STATE in src:
    src = src.replace(VIEWING_STATE, VIEWING_STATE + "\n  " + PDF_STATE)
    print("OK  — pdfLoading state + consultationComplete inserted")
else:
    # Fallback: inject before the return statement
    src = src.replace(
        "  return (\n",
        f"  {PDF_STATE}\n\n  return (\n",
        1
    )
    print("OK  — pdfLoading state injected before return (fallback)")

# ──────────────────────────────────────────────────────────────────────────────
# 6.  Replace the old action-area div (which held the three removed controls)
#     with the Download Report button.
#
#     The outer wrapper JSX (from the grep) looks like:
#       <div className="...">          ← patient card right side
#         <div className="flex items-center gap-3">
#           [controls were here — now removed]
#         </div>
#       </div>
#
#     After step 4 the inner div may be empty or gone. We insert our button
#     by placing it just before the closing of the patient-card section,
#     specifically before <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
#     which starts the info panels.
# ──────────────────────────────────────────────────────────────────────────────

DOWNLOAD_BTN = """
      {/* Download Full Report — visible once a consultation is completed */}
      <div className="flex items-center justify-end mb-1">
        {consultationComplete ? (
          <button
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                await generatePatientPDF(patient, appointments ?? [], prescriptions ?? [], labs ?? [], invoices ?? []);
              } finally {
                setPdfLoading(false);
              }
            }}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
          >
            <FileDown size={15} />
            {pdfLoading ? 'Generating…' : 'Download Full Report'}
          </button>
        ) : (
          <span className="text-xs text-clinical-400 italic">
            Report available after consultation is completed
          </span>
        )}
      </div>
"""

GRID_ANCHOR = '<div className="grid grid-cols-1 md:grid-cols-2 gap-4">'
if GRID_ANCHOR in src:
    src = src.replace(GRID_ANCHOR, DOWNLOAD_BTN + GRID_ANCHOR, 1)
    print("OK  — Download Full Report button inserted above info grid")
else:
    print("WARN — could not find info-grid anchor; insert button manually above the grid")

# ──────────────────────────────────────────────────────────────────────────────
# 7.  Write back
# ──────────────────────────────────────────────────────────────────────────────
# Backup first
backup = TARGET.with_suffix(".tsx.bak")
backup.write_text(original, encoding="utf-8")
print(f"OK  — backup saved to {backup.name}")

TARGET.write_text(src, encoding="utf-8")
print(f"SUCCESS — {TARGET.name} patched.")
print("Restart the frontend dev server if it doesn't hot-reload cleanly.")
