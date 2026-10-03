// ─────────────────────────────────────────────────────────────────────────
// BRANDED generatePatientPDF — matches the SOMCARE report template
// Drop this in to REPLACE the existing generatePatientPDF() function in
// PatientDetailPage.tsx (same signature, same imports — jsPDF + jspdf-autotable
// using the v4 `autoTable(doc, {...})` call style already in your file).
//
// Design notes:
//  - Header (logo mark + wordmark + tagline + contact block) repeats, in a
//    slimmer form, at the top of every page.
//  - A red "ribbon" title bar under the header shows the current section
//    name (CLINICAL PATIENT REPORT / LABORATORY RESULTS / PRESCRIPTIONS /
//    INVOICES), matching the diagonal ribbon look in your reference images.
//  - Personal Info / Medical Info / Chief Complaint / HPI / Examination
//    Findings / Diagnosis are rendered as rounded "cards": a solid red
//    header bar + a light tinted body box — matching Image 2 exactly.
//  - Lab Results, Prescriptions, and Invoices each start on their own new
//    page (as agreed) and are left as plain autoTable tables for now —
//    ready to restyle into the card look later.
//  - Footer: thin red bar + "Confidential — SOMCARE Clinical Management
//    System" + page number, on every page.
//
// If you have the actual SOMCARE logo as a PNG/SVG, swap the drawLogo()
// body for a doc.addImage(logoBase64, 'PNG', x, y, w, h) call — vector
// shapes below are a close approximation, not a pixel copy of the artwork.
// ─────────────────────────────────────────────────────────────────────────

async function generatePatientPDF(
  patient: any,
  appointments: any[],
  prescriptions: any[],
  labOrders: any[],
  invoices: any[],
  facility: {
    name?: string;
    tagline?: string;
    address?: string;
    phone?: string;
    email?: string;
    logoBase64?: string; // data URI, e.g. "data:image/png;base64,...." — see loadImageAsBase64() below
  } = {},
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mg = 15;
  const cw = pw - mg * 2;

  const fName = facility.name ?? 'SOMCARE Medical Center';
  const fTagline = facility.tagline ?? 'Better Care \u2022 Healthier Tomorrow';
  const fAddress = facility.address ?? 'Hargeisa, Woqooyi Galbeed, Somaliland';
  const fPhone = facility.phone ?? '+252 63 0000000';
  const fEmail = facility.email ?? 'info@somcare.com';

  const brand: [number, number, number] = [140, 14, 22];    // dark red — used ONLY for the big page ribbon + wordmark accent
  const cardBar: [number, number, number] = [52, 54, 63];   // charcoal navy — used for the small section card headers
  const brandTint: [number, number, number] = [250, 250, 251]; // near-white card body (was pink)
  const grayTint: [number, number, number] = [246, 246, 248];
  const dark: [number, number, number] = [30, 30, 30];
  const mid: [number, number, number] = [110, 110, 110];

  let y = mg;
  let pageNum = 1;

  // ── logo mark — uses the uploaded facility logo if one exists, otherwise
  // falls back to a vector heart+cross approximation ────────────────────
  function drawLogo(x: number, cy: number, r: number) {
    if (facility.logoBase64) {
      const fmt = facility.logoBase64.includes('image/png') ? 'PNG'
        : facility.logoBase64.includes('image/webp') ? 'WEBP' : 'JPEG';
      try {
        doc.addImage(facility.logoBase64, fmt, x - r, cy - r, r * 2, r * 2);
        return;
      } catch {
        // fall through to vector mark if the image fails to decode
      }
    }
    doc.setFillColor(...brand);
    doc.circle(x, cy, r, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(r * 0.28);
    doc.line(x, cy - r * 0.55, x, cy + r * 0.55);
    doc.line(x - r * 0.55, cy, x + r * 0.55, cy);
  }

  // ── full header (logo + wordmark + tagline + contact block) ───────────
  function drawHeader(sectionTitle: string) {
    y = 10;
    drawLogo(mg + 6, y + 3, 6);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.setTextColor(...dark);
    // Wordmark: renders the facility name as-is; if it's the default "SOMCARE..."
    // name, split "SOM"/"CARE" into two colors like the reference branding.
    if (/^SOM\s*CARE/i.test(fName)) {
      doc.text('SOM', mg + 16, y + 6);
      const somW = doc.getTextWidth('SOM');
      doc.setTextColor(...brand); doc.text('CARE', mg + 16 + somW, y + 6);
    } else {
      doc.text(fName, mg + 16, y + 6);
    }

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(70, 70, 70);
    doc.text('CLINICAL MANAGEMENT SYSTEM', mg + 16, y + 10);

    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.setTextColor(...brand);
    doc.text(fTagline, mg + 16, y + 14);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(...dark);
    doc.text(fName, pw - mg, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(...mid);
    doc.text(fAddress, pw - mg, y + 4.5, { align: 'right' });
    doc.text(fPhone, pw - mg, y + 9, { align: 'right' });
    doc.text(fEmail, pw - mg, y + 13.5, { align: 'right' });

    y += 20;
    doc.setDrawColor(...brand); doc.setLineWidth(0.6);
    doc.line(0, y, pw, y);

    // diagonal ribbon title bar — the "big title", visually distinct from card headers below
    y += 4;
    const bandH = 9;
    const cutStart = pw * 0.5;
    doc.setFillColor(20, 20, 22);
    doc.triangle(cutStart, y, cutStart + 12, y, cutStart, y + bandH, 'F');
    doc.rect(cutStart + 12, y, pw - (cutStart + 12), bandH, 'F');
    doc.setFillColor(...brand);
    doc.triangle(cutStart + 6, y, cutStart + 18, y, cutStart + 6, y + bandH, 'F');
    doc.rect(cutStart + 18, y, pw - (cutStart + 18), bandH, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.text(sectionTitle.toUpperCase(), pw - mg, y + bandH - 2.5, { align: 'right' });

    y += bandH + 6;
    doc.setTextColor(...dark);
  }

  // faint corner watermark — heart+cross mark, used once on the main report page
  function drawWatermark(x: number, cy: number, r: number) {
    doc.setFillColor(250, 227, 230);
    doc.circle(x, cy, r, 'F');
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(r * 0.22);
    doc.line(x, cy - r * 0.5, x, cy + r * 0.5);
    doc.line(x - r * 0.5, cy, x + r * 0.5, cy);
  }

  function drawFooter() {
    doc.setDrawColor(...brand); doc.setLineWidth(0.4);
    doc.line(mg, ph - 12, pw - mg, ph - 12);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8);
    doc.setTextColor(...brand);
    doc.text(`${fName.split(' ')[0] || 'SOMCARE'} \u2022 Your Health, Our Priority`, mg, ph - 7);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(...mid);
    doc.text(`Confidential  \u2022  Page ${pageNum}`, pw - mg, ph - 7, { align: 'right' });
  }

  function newPage(sectionTitle: string) {
    drawFooter();
    doc.addPage();
    pageNum += 1;
    drawHeader(sectionTitle);
  }

  // page-break guard used mid-section (keeps footer/header consistent)
  function chk(sectionTitle: string, need = 25) {
    if (y + need > ph - 14) newPage(sectionTitle);
  }

  // ── card helpers (Personal/Medical/Clinical Notes look) ───────────────
  // simple white line-icons drawn inside the card header bar, one per section
  function drawTitleIcon(kind: string, cx: number, cy: number) {
    doc.setDrawColor(255, 255, 255);
    doc.setFillColor(255, 255, 255);
    doc.setLineWidth(0.45);
    const s = 2.1;
    switch (kind) {
      case 'person':
        doc.circle(cx, cy - 0.9, 0.85, 'F');
        doc.triangle(cx - s * 0.65, cy + 1.3, cx + s * 0.65, cy + 1.3, cx, cy - 0.1, 'F');
        break;
      case 'medical':
        doc.rect(cx - 0.35, cy - s * 0.75, 0.7, s * 1.5, 'F');
        doc.rect(cx - s * 0.75, cy - 0.35, s * 1.5, 0.7, 'F');
        break;
      case 'stethoscope':
        doc.circle(cx, cy + 1, 0.7, 'S');
        doc.line(cx - 1.1, cy - 1.4, cx - 1.1, cy + 0.3);
        doc.line(cx + 1.1, cy - 1.4, cx + 1.1, cy + 0.3);
        doc.line(cx - 1.1, cy + 0.3, cx, cy + 0.3);
        doc.line(cx + 1.1, cy + 0.3, cx, cy + 0.3);
        doc.circle(cx - 1.1, cy - 1.6, 0.3, 'F');
        doc.circle(cx + 1.1, cy - 1.6, 0.3, 'F');
        break;
      case 'document':
        doc.rect(cx - 1.3, cy - 1.6, 2.6, 3.2, 'S');
        doc.line(cx - 0.8, cy - 0.7, cx + 0.8, cy - 0.7);
        doc.line(cx - 0.8, cy + 0.1, cx + 0.8, cy + 0.1);
        doc.line(cx - 0.8, cy + 0.9, cx + 0.8, cy + 0.9);
        break;
      case 'search':
        doc.circle(cx - 0.3, cy - 0.3, 1.15, 'S');
        doc.setLineWidth(0.6);
        doc.line(cx + 0.6, cy + 0.6, cx + 1.5, cy + 1.5);
        break;
      case 'clipboard':
        doc.rect(cx - 1.3, cy - 1.5, 2.6, 3.2, 'S');
        doc.rect(cx - 0.6, cy - 1.9, 1.2, 0.7, 'F');
        doc.line(cx - 0.8, cy - 0.4, cx + 0.8, cy - 0.4);
        doc.line(cx - 0.8, cy + 0.3, cx + 0.8, cy + 0.3);
        doc.line(cx - 0.8, cy + 1.0, cx + 0.8, cy + 1.0);
        break;
      default:
        doc.circle(cx, cy, 0.9, 'F');
    }
  }

  function cardHeader(title: string, icon = 'document') {
    doc.setFillColor(...cardBar);
    doc.roundedRect(mg, y, cw, 6, 1.2, 1.2, 'F');
    drawTitleIcon(icon, mg + 4, y + 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.8);
    doc.setTextColor(255, 255, 255);
    doc.text(title, mg + 8.5, y + 4.1);
    y += 6;
  }

  function infoGrid(pairs: [string, string][], tint: [number, number, number] = grayTint) {
    const rowH = 5.4;
    const bodyH = Math.ceil(pairs.length / 2) * rowH + 3;
    doc.setFillColor(...tint);
    doc.rect(mg, y, cw, bodyH, 'F');
    let ry = y + 5;
    const colGap = cw / 2;
    for (let i = 0; i < pairs.length; i += 2) {
      const [l1, v1] = pairs[i];
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
      doc.setTextColor(...mid); doc.text(l1, mg + 3, ry);
      doc.setTextColor(...dark); doc.text(String(v1 ?? '\u2014'), mg + 36, ry);
      if (pairs[i + 1]) {
        const [l2, v2] = pairs[i + 1];
        doc.setTextColor(...mid); doc.text(l2, mg + colGap + 3, ry);
        doc.setTextColor(...dark); doc.text(String(v2 ?? '\u2014'), mg + colGap + 28, ry);
      }
      ry += rowH;
    }
    y += bodyH + 4;
  }

  function narrativeCard(title: string, text: string, icon = 'document') {
    chk('Clinical Patient Report', 20);
    cardHeader(title, icon);
    const wrapped = doc.splitTextToSize(text?.trim() ? text : '\u2014', cw - 8);
    const bodyH = wrapped.length * 4.4 + 5;
    doc.setFillColor(...brandTint);
    doc.rect(mg, y, cw, bodyH, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.setTextColor(...dark);
    doc.text(wrapped, mg + 4, y + 5.5);
    y += bodyH + 4;
  }

  // "Approved and Verified by" block — used at the end of every section,
  // each with the role responsible for that section's content.
  function approvalBlock(sectionTitle: string, role: string, name?: string) {
    chk(sectionTitle, 26);
    y += 6;
    doc.setDrawColor(...mid); doc.setLineWidth(0.3);
    doc.line(mg, y, mg + 75, y);
    doc.line(pw - mg - 55, y, pw - mg, y);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text('Approved and Verified by', mg, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
    doc.text(name ?? '\u2014', mg, y + 9.5);
    doc.text(role, mg, y + 13.5);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text('Date', pw - mg - 55, y + 5);
    doc.text('Time', pw - mg - 22, y + 5);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mid);
    doc.text(dateStr, pw - mg - 55, y + 9.5);
    doc.text(timeStr, pw - mg - 22, y + 9.5);

    y += 18;
  }

  // ═══════════════════════ PAGE 1: CLINICAL PATIENT REPORT ═══════════════
  drawHeader('Clinical Patient Report');

  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.156e10)
    : null;
  const dob = patient.dateOfBirth
    ? new Date(patient.dateOfBirth).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '\u2014';

  cardHeader('1. Personal Information', 'person');
  infoGrid([
    ['Patient ID', patient.patientNumber ?? '\u2014'],
    ['Address', [patient.city, patient.country].filter(Boolean).join(', ') || '\u2014'],
    ['Full Name', `${patient.firstName ?? ''} ${patient.lastName ?? ''}`.trim() || '\u2014'],
    ['Phone', patient.phone ?? '\u2014'],
    ['Date of Birth', dob],
    ['Blood Group', patient.bloodGroup ?? '\u2014'],
    ['Age / Gender', age ? `${age} Years / ${patient.gender ?? '\u2014'}` : (patient.gender ?? '\u2014')],
    ['Status', patient.status ?? 'Active'],
  ]);
  y += 2;

  chk('Clinical Patient Report', 20);
  cardHeader('2. Medical Information', 'medical');
  infoGrid([
    ['Allergies', patient.allergies ?? 'No known allergies'],
    ['Insurance', patient.insurance ?? '\u2014'],
    [
      'Emergency Contact',
      patient.emergencyContactName
        ? `${patient.emergencyContactName}${patient.emergencyContactPhone ? ` (${patient.emergencyContactPhone})` : ''}`
        : '\u2014',
    ],
  ]);

  // most recently completed visit — for Chief Complaint / HPI / Exam / Dx
  const completedVisits = (appointments ?? [])
    .filter((v: any) => v.status === 'completed')
    .sort((a: any, b: any) => new Date(b.checkInAt ?? b.createdAt).getTime() - new Date(a.checkInAt ?? a.createdAt).getTime());
  const latestVisit = completedVisits[0];

  if (latestVisit) {
    narrativeCard('Chief Complaint', latestVisit.chiefComplaint, 'stethoscope');
    narrativeCard('History of Present Illness', latestVisit.historyOfPresentIllness, 'document');
    narrativeCard('Examination Findings', latestVisit.examinationFindings, 'search');
    narrativeCard('Diagnosis', latestVisit.diagnosis, 'clipboard');
  } else {
    chk('Clinical Patient Report', 16);
    cardHeader('Clinical Notes', 'document');
    doc.setFillColor(...brandTint);
    doc.rect(mg, y, cw, 10, 'F');
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No clinical notes recorded.', mg + 4, y + 6.5);
    y += 14;
  }

  // faint watermark in the unused corner space above the signature
  drawWatermark(pw - mg - 14, y + 10, 9);

  approvalBlock(
    'Clinical Patient Report',
    'Consulting Physician',
    latestVisit?.doctorName ?? latestVisit?.doctor?.name ?? undefined,
  );

  // ═══════════════════════ LAB RESULTS (own page) ═════════════════════════
  const flattenedLabs = (labOrders ?? []).flatMap((order: any) =>
    (order.items ?? []).map((item: any) => ({ ...item, orderDate: order.createdAt })),
  );

  newPage('Laboratory Results');
  if (flattenedLabs.length) {
    autoTable(doc, {
      startY: y, margin: { left: mg, right: mg },
      head: [['Test', 'Result', 'Unit', 'Reference Range', 'Date', 'Flag']],
      body: flattenedLabs.map((r: any) => [
        r.testName ?? '\u2014',
        r.resultValue ?? '\u2014',
        r.unit ?? '\u2014',
        r.referenceRange ?? '\u2014',
        r.orderDate ? new Date(r.orderDate).toLocaleDateString() : '\u2014',
        r.flag ?? '\u2014',
      ]),
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: grayTint },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No lab results recorded.', mg + 2, y); y += 8;
  }
  approvalBlock('Laboratory Results', 'Laboratory Technician');

  // ═══════════════════════ PRESCRIPTIONS (own page) ═══════════════════════
  newPage('Prescriptions');
  if (prescriptions?.length) {
    autoTable(doc, {
      startY: y, margin: { left: mg, right: mg },
      head: [['Medication', 'Dose / Freq / Duration', 'Dispensed as', 'Qty', 'Status']],
      body: prescriptions.map((p: any) => [
        p.drugName ?? '\u2014',
        [p.dose, p.frequency, p.duration].filter(Boolean).join(' \u00b7 ') || '\u2014',
        `${p.medicine?.name ?? '\u2014'}${p.medicine?.unit ? ` (${p.medicine.unit})` : ''}`,
        p.quantity ?? '\u2014',
        p.status ?? '\u2014',
      ]),
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: grayTint },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No prescriptions recorded.', mg + 2, y); y += 8;
  }
  approvalBlock('Prescriptions', 'Pharmacist');

  // ═══════════════════════ INVOICES (own page) ════════════════════════════
  newPage('Invoices');
  if (invoices?.length) {
    autoTable(doc, {
      startY: y, margin: { left: mg, right: mg },
      head: [['Invoice #', 'Date', 'Total', 'Paid', 'Due', 'Status']],
      body: invoices.map((i: any) => [
        i.invoiceNumber ?? i.id?.slice(0, 8) ?? '\u2014',
        i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '\u2014',
        `$${Number(i.total ?? 0).toFixed(2)}`,
        `$${Number(i.paid ?? 0).toFixed(2)}`,
        `$${Number((i.total ?? 0) - (i.paid ?? 0)).toFixed(2)}`,
        i.status ?? '\u2014',
      ]),
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: grayTint },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No invoices recorded.', mg + 2, y); y += 8;
  }
  approvalBlock('Invoices', 'Receptionist / Front Desk');

  drawFooter();

  const pid = patient.patientNumber ?? patient.id ?? 'patient';
  doc.save(`${pid}_consultation_report.pdf`);
}
