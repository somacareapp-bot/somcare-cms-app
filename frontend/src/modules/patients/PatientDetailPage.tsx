import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, Phone, MapPin, Droplet, Calendar, Pill, FlaskConical, Scan, Receipt, Eye, FileDown } from 'lucide-react';
import api, { patientsApi, visitsApi, usersApi, appointmentsApi, labApi, radiologyApi, billingApi, facilityApi } from '../../services/api';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { InvoiceModal, InvoiceSourceBadges } from '../billing/InvoicesPage';
import { loadImageAsBase64 } from '../settings/loadImageAsBase64';
import { registerSignatureFont } from './signatureFont';

// urgencyOptions removed — check-in flow moved to Appointments tab

const tabs = [
  { key: 'appointments', label: 'Appointments', icon: Calendar },
  { key: 'prescriptions', label: 'Prescriptions', icon: Pill },
  { key: 'labs', label: 'Lab Results', icon: FlaskConical },
  { key: 'radiology', label: 'Radiology', icon: Scan },
  { key: 'invoices', label: 'Invoices', icon: Receipt },
] as const;

type TabKey = typeof tabs[number]['key'];




// ── PDF report generator (loads jsPDF from CDN on first call) ───────────────
async function generatePatientPDF(
  patient: any,
  appointments: any[],
  prescriptions: any[],
  labOrders: any[],
  invoices: any[],
  facility: any = {},
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const mg = 15;
  const cw = pw - mg * 2;

  const brand: [number, number, number] = [140, 14, 22];    // dark red — used ONLY for the big page ribbon + wordmark accent
  const cardBar: [number, number, number] = [52, 54, 63];   // charcoal navy — used for the small section card headers
  const brandTint: [number, number, number] = [250, 250, 251]; // near-white card body (was pink)
  const grayTint: [number, number, number] = [246, 246, 248];
  const dark: [number, number, number] = [30, 30, 30];
  const mid: [number, number, number] = [110, 110, 110];

  let y = mg;
  let pageNum = 1;

  // ── logo mark (vector approximation: heart-ish disc + cross) ──────────
  function drawLogo(x: number, cy: number, r: number) {
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
    const logoData: string | undefined = facility?.logoBase64;
    const logoIsRaster = typeof logoData === 'string' && /^data:image\/(png|jpe?g)/i.test(logoData);
    if (logoIsRaster) {
      try {
        const fmt = /data:image\/png/i.test(logoData!) ? 'PNG' : 'JPEG';
        doc.addImage(logoData!, fmt, mg, y - 3, 12, 12);
      } catch {
        drawLogo(mg + 6, y + 3, 6);
      }
    } else {
      drawLogo(mg + 6, y + 3, 6);
    }

    const facilityName: string = facility?.name || 'SOMCARE Medical Center';
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
    doc.setTextColor(...dark); doc.text(facilityName, mg + 16, y + 6);

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.setTextColor(70, 70, 70);
    doc.text('CLINICAL MANAGEMENT SYSTEM', mg + 16, y + 10);

    doc.setFont('helvetica', 'italic'); doc.setFontSize(7);
    doc.setTextColor(...brand);
    doc.text(facility?.tagline || 'Better Care  \u2022  Healthier Tomorrow', mg + 16, y + 14);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    doc.setTextColor(...dark);
    doc.text(facilityName, pw - mg, y, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(...mid);
    doc.text(facility?.address || 'Hargeisa, Woqooyi Galbeed, Somaliland', pw - mg, y + 4.5, { align: 'right' });
    doc.text(facility?.phone || '+252 63 0000000', pw - mg, y + 9, { align: 'right' });
    doc.text(facility?.email || 'info@somcare.com', pw - mg, y + 13.5, { align: 'right' });

    const paymentParts: string[] = [];
    if (facility?.eDahabNumber) paymentParts.push(`E-Dahab: ${facility.eDahabNumber}`);
    if (facility?.zaadNumber) paymentParts.push(`Zaad: ${facility.zaadNumber}`);
    if (facility?.accountNumber) paymentParts.push(`Acc: ${facility.accountNumber}`);
    if (paymentParts.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
      doc.setTextColor(...brand);
      doc.text(paymentParts.join('   \u2022   '), pw - mg, y + 18, { align: 'right' });
    }

    y += 24;
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
    doc.text('SOMCARE \u2022 Your Health, Our Priority', mg, ph - 7);
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
  // Left: who approved it, in plain text. Right: signature above the line,
  // date/time below it.
  function approvalBlock(sectionTitle: string, role: string, name?: string) {
    chk(sectionTitle, 32);
    y += 10;

    const rightX = pw - mg - 70;

    // Left — plain-text identity of the approver
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text('Approved and Verified by', mg, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...dark);
    doc.text(name ?? '\u2014', mg, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
    doc.text(role, mg, y + 10.5);

    // Right, above the line — the rendered signature (first name only —
    // a cursive rendering of a full legal name reads cluttered at this size)
    if (name) {
      const signatureName = name.trim().split(/\s+/)[0];
      registerSignatureFont(doc);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...mid);
      doc.text('DocuSigned by', rightX, y - 4);
      doc.setFont('Sacramento', 'normal'); doc.setFontSize(16); doc.setTextColor(...brand);
      doc.text(signatureName, rightX, y + 1);
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...mid);
      doc.text('Not yet signed', rightX, y + 1);
    }
    doc.setDrawColor(...mid); doc.setLineWidth(0.3);
    doc.line(rightX - 1, y + 4, pw - mg, y + 4);

    // Right, below the line — date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text('Date', rightX, y + 9);
    doc.text('Time', rightX + 35, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mid);
    doc.text(dateStr, rightX, y + 13);
    doc.text(timeStr, rightX + 35, y + 13);

    y += 20;
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

  // ═══════════════════════ LAB RESULTS (own page, grouped by category) ═════
  const flattenedLabs = (labOrders ?? []).flatMap((order: any) =>
    (order.items ?? []).map((item: any) => ({ ...item, orderDate: order.createdAt })),
  );

  const flagColors: Record<string, [number, number, number]> = {
    high: [178, 34, 34],
    low: [180, 130, 20],
    normal: [40, 120, 60],
  };

  // Plain-text sub-heading — no filled box, just a bold label in brand color
  // with a thin rule underneath. Avoids stacking a second boxed bar directly
  // above the table's own red header row, which read as doubled-up lines.
  function drawCategoryBar(label: string, count: number) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.setTextColor(...brand);
    doc.text(label.toUpperCase(), mg, y + 3.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    doc.setTextColor(...mid);
    doc.text(`${count} test${count !== 1 ? 's' : ''}`, mg + cw, y + 3.5, { align: 'right' });
    doc.setDrawColor(...brand); doc.setLineWidth(0.4);
    doc.line(mg, y + 5.5, mg + cw, y + 5.5);
    y += 5.5 + 3;
  }

  // Rough height a category's heading + table will take, so chk() can move
  // the WHOLE category to a fresh page instead of letting autoTable split it
  // mid-table (which strands a bare repeated header on the next page).
  function estimateCategoryHeight(rowCount: number) {
    return 5.5 + 3 + 6 + rowCount * 5.5 + 6; // heading + gap + table head + rows + trailing gap
  }

  newPage('Laboratory Results');
  if (flattenedLabs.length) {
    const byCategory = flattenedLabs.reduce((acc: Record<string, any[]>, r: any) => {
      const cat = r.category || 'Other';
      (acc[cat] ||= []).push(r);
      return acc;
    }, {});

    // Deterministic order — alphabetical, with "Other" always pushed to the end
    // rather than sorting into the middle of the alphabet.
    const categories = Object.keys(byCategory).sort((a, b) => {
      if (a === 'Other') return 1;
      if (b === 'Other') return -1;
      return a.localeCompare(b);
    });

    for (const category of categories) {
      const rows = byCategory[category];
      // Reserve the category's full estimated height so a long category moves
      // to the next page as one block rather than splitting mid-table.
      chk('Laboratory Results', estimateCategoryHeight(rows.length));
      drawCategoryBar(category, rows.length);

      autoTable(doc, {
        startY: y, margin: { left: mg, right: mg, bottom: 20 },
        head: [['Test', 'Result', 'Unit', 'Reference Range', 'Date', 'Flag']],
        body: rows.map((r: any) => [
          r.testName ?? '\u2014',
          r.resultValue ?? '\u2014',
          r.unit ?? '\u2014',
          r.referenceRange ?? '\u2014',
          r.orderDate ? new Date(r.orderDate).toLocaleDateString() : '\u2014',
          (r.flag ?? '\u2014') as string,
        ]),
        headStyles: { fillColor: brand, fontSize: 7.5, cellPadding: 1.8 },
        bodyStyles: { fontSize: 7.5, cellPadding: 1.8 },
        alternateRowStyles: { fillColor: grayTint },
        // Color the Flag cell (last column) so abnormal results are
        // immediately visible without reading the text.
        didParseCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 5) {
            const flag = String(data.cell.raw ?? '').toLowerCase();
            const c = flagColors[flag];
            if (c) {
              data.cell.styles.textColor = c;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No lab results recorded.', mg + 2, y); y += 8;
  }
  const verifiedByName = (labOrders ?? [])
    .filter((o: any) => o.verifiedByName)
    .sort((a: any, b: any) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0]?.verifiedByName;
  approvalBlock('Laboratory Results', 'Laboratory Technician', verifiedByName);

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
  const dispensedByName = (prescriptions ?? [])
    .filter((p: any) => p.dispensedByName)
    .sort((a: any, b: any) => new Date(b.dispensedAt ?? 0).getTime() - new Date(a.dispensedAt ?? 0).getTime())[0]?.dispensedByName;
  approvalBlock('Prescriptions', 'Pharmacist', dispensedByName);

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
  const collectedByName = (invoices ?? [])
    .filter((i: any) => i.collectedByName)
    .sort((a: any, b: any) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0]?.collectedByName;
  approvalBlock('Invoices', 'Receptionist / Front Desk', collectedByName);

  drawFooter();

  const pid = patient.patientNumber ?? patient.id ?? 'patient';
  doc.save(`${pid}_consultation_report.pdf`);
}





// ────────────────────────────────────────────────────────────────────────────
function PrescriptionsTab({ prescriptions, navigate }: { prescriptions: any[]; navigate: (path: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Group by visit
  const byVisit = prescriptions.reduce<Record<string, any[]>>((acc, p) => {
    const key = p.visitNumber ?? p.visitId ?? 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});




  return (
    <div className="space-y-2">
      {Object.entries(byVisit).map(([visitNumber, rxList]) => {
        const isOpen = expandedId === visitNumber;
        const allDispensed = rxList.every((p) => p.status === 'dispensed');
        const anyPending  = rxList.some((p)  => p.status === 'pending');
        const visitDate   = rxList[0]?.visitDate ?? rxList[0]?.createdAt;

        return (
          <div key={visitNumber} className="border border-clinical-100 rounded-xl overflow-hidden">
            {/* Visit summary row */}
            <button
              onClick={() => setExpandedId(isOpen ? null : visitNumber)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                allDispensed ? 'bg-green-400' :
                anyPending   ? 'bg-amber-400' : 'bg-gray-300'
              }`} />
              <span className="text-xs font-mono text-clinical-500 w-28 shrink-0">{visitNumber}</span>
              <span className="flex-1 text-sm text-clinical-800 truncate">
                {rxList.map((p) => p.drugName).join(', ')}
              </span>
              <span className="text-xs text-clinical-400 shrink-0 w-20 text-right">
                {visitDate ? new Date(visitDate).toLocaleDateString() : '—'}
              </span>
              <span className="shrink-0 w-24 text-right">
                <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full ${
                  allDispensed ? 'bg-green-100 text-green-700' :
                  anyPending   ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-500'
                }`}>
                  {allDispensed ? 'Dispensed' : anyPending ? 'Pending' : 'Cancelled'}
                </span>
              </span>
              <span className="text-clinical-400 text-xs ml-2">{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Expanded per-drug rows */}
            {isOpen && (
              <div className="border-t border-clinical-100">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Drug</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Dose · Freq · Duration</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Dispensed as</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Qty</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rxList.map((p: any) => (
                      <tr
                        key={p.id}
                        className={`border-t border-gray-50 ${
                          p.status === 'pending'   ? 'bg-amber-50/30' :
                          p.status === 'dispensed' ? '' :
                          'bg-gray-50/40'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-medium text-clinical-900">{p.drugName}</td>
                        <td className="px-3 py-2.5 text-clinical-500 text-xs">
                          {[p.dose, p.frequency, p.duration].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-2.5 text-clinical-500 text-xs">
                          {p.medicine?.name ?? '—'}
                          {p.medicine?.unit ? ` (${p.medicine.unit})` : ''}
                        </td>
                        <td className="px-3 py-2.5 text-clinical-500 text-xs">{p.quantity ?? '—'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                            p.status === 'dispensed' ? 'bg-green-100 text-green-700' :
                            p.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {anyPending && (
                  <div className="flex justify-end px-4 py-2.5 border-t border-gray-100">
                    <button
                      onClick={() => navigate('/pharmacy/dispensing')}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Go to dispensing →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

type LabFlag = 'low' | 'high' | 'normal' | null;

function LabFlagBadge({ flag }: { flag: LabFlag }) {
  if (!flag) return <span className="text-gray-300 text-xs">—</span>;
  const styles: Record<string, string> = {
    high:   'bg-red-50 text-red-700 border border-red-200',
    low:    'bg-amber-50 text-amber-700 border border-amber-200',
    normal: 'bg-green-50 text-green-700 border border-green-200',
  };

  return (
    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${styles[flag]}`}>
      {flag === 'high' ? 'H' : flag === 'low' ? 'L' : 'N'}
    </span>
  );
}

function RadiologyOrdersTab({ radiologyOrders, navigate }: { radiologyOrders: any[]; navigate: (path: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="space-y-2 -mx-1">
      <table className="w-full text-sm mb-1">
        <thead>
          <tr className="text-left text-xs uppercase text-clinical-400 border-b border-clinical-100">
            <th className="py-2 pr-4 font-semibold pl-1">Order #</th>
            <th className="py-2 pr-4 font-semibold">Studies</th>
            <th className="py-2 pr-4 font-semibold">Ordered</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 font-semibold"></th>
          </tr>
        </thead>
      </table>

      {radiologyOrders.map((r: any) => {
        const isOpen = expandedId === r.id;
        const isCompleted = r.status === 'completed';

        return (
          <div key={r.id} className="border border-clinical-100 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedId(isOpen ? null : r.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                isCompleted ? 'bg-green-400' : 'bg-gray-300'
              }`} />
              <span className="text-xs font-mono text-clinical-500 w-32 shrink-0">{r.radiologyOrderNumber}</span>
              <span className="flex-1 text-sm text-clinical-800 truncate">{r.testName}</span>
              <span className="text-xs text-clinical-400 shrink-0 w-20 text-right">
                {r.orderedAt ? new Date(r.orderedAt).toLocaleDateString() : '—'}
              </span>
              <span className="shrink-0 w-24 text-right">
                <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                  r.status === 'completed' ? 'bg-green-100 text-green-700' :
                  r.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  r.status === 'ordered' ? 'bg-clinical-100 text-clinical-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {r.status?.replace(/_/g, ' ')}
                </span>
              </span>
              <span className="text-clinical-400 text-xs ml-2">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
              <div className="border-t border-clinical-100">
                {(r.items ?? []).length === 0 ? (
                  <p className="text-sm text-clinical-400 px-4 py-3">No studies recorded.</p>
                ) : (
                  <div className="divide-y divide-clinical-50">
                    {(r.items ?? []).map((item: any) => (
                      <div key={item.id} className="px-4 py-3">
                        <p className="text-sm font-semibold text-clinical-800">{item.testName}</p>
                        <p className="text-sm text-clinical-600 mt-1 whitespace-pre-wrap">
                          {item.resultText?.trim() || (
                            <span className="text-clinical-400 italic">No findings entered yet.</span>
                          )}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LabOrdersTab({ labOrders, navigate }: { labOrders: any[]; navigate: (path: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);


  return (
    <div className="space-y-2 -mx-1">
      {/* Table header */}
      <table className="w-full text-sm mb-1">
        <thead>
          <tr className="text-left text-xs uppercase text-clinical-400 border-b border-clinical-100">
            <th className="py-2 pr-4 font-semibold pl-1">Order #</th>
            <th className="py-2 pr-4 font-semibold">Test</th>
            <th className="py-2 pr-4 font-semibold">Ordered</th>
            <th className="py-2 pr-4 font-semibold">Status</th>
            <th className="py-2 font-semibold"></th>
          </tr>
        </thead>
      </table>

      {labOrders.map((l: any) => {
        const isOpen = expandedId === l.id;
        const hasCritical = (l.items ?? []).some((i: any) => i.flag === 'high' || i.flag === 'low');
        const isCompleted = l.status === 'completed';

        return (
          <div key={l.id} className="border border-clinical-100 rounded-xl overflow-hidden">
            {/* Summary row */}
            <button
              onClick={() => setExpandedId(isOpen ? null : l.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${
                !isCompleted ? 'bg-gray-300' :
                hasCritical ? 'bg-red-400' : 'bg-green-400'
              }`} />
              <span className="text-xs font-mono text-clinical-500 w-32 shrink-0">{l.labOrderNumber}</span>
              <span className="flex-1 text-sm text-clinical-800 truncate">{l.testName}</span>
              <span className="text-xs text-clinical-400 shrink-0 w-20 text-right">
                {l.orderedAt ? new Date(l.orderedAt).toLocaleDateString() : '—'}
              </span>
              <span className="shrink-0 w-24 text-right">
                <span className={`inline-flex text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                  l.status === 'completed' ? 'bg-green-100 text-green-700' :
                  l.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                  l.status === 'ordered' ? 'bg-clinical-100 text-clinical-600' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {l.status?.replace(/_/g, ' ')}
                </span>
              </span>
              <span className="text-clinical-400 text-xs ml-2">{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Expanded per-test results */}
            {isOpen && (
              <div className="border-t border-clinical-100">
                {(l.items ?? []).length === 0 ? (
                  <p className="text-sm text-clinical-400 px-4 py-3">No test items recorded.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="text-left px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Test</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Result</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Unit</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Reference</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide">Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {l.items.map((item: any) => (
                        <tr
                          key={item.id}
                          className={`border-t border-gray-50 ${
                            item.flag === 'high' ? 'bg-red-50/40' :
                            item.flag === 'low'  ? 'bg-amber-50/40' : ''
                          }`}
                        >
                          <td className="px-4 py-2.5 font-medium text-clinical-900">{item.testName}</td>
                          <td className={`px-3 py-2.5 font-semibold ${
                            item.flag === 'high'   ? 'text-red-700' :
                            item.flag === 'low'    ? 'text-amber-700' :
                            item.flag === 'normal' ? 'text-green-700' :
                            'text-clinical-400'
                          }`}>
                            {item.resultValue ?? '—'}
                          </td>
                          <td className="px-3 py-2.5 text-clinical-500 text-xs">{item.unit || '—'}</td>
                          <td className="px-3 py-2.5 text-clinical-500 font-mono text-xs">{item.referenceRange || '—'}</td>
                          <td className="px-3 py-2.5 text-center"><LabFlagBadge flag={item.flag} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {isCompleted && (
                  <div className="flex justify-end px-4 py-2.5 border-t border-gray-100">
                    <button
                      onClick={() => navigate(`/laboratory/${l.id}/result`)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Open full view →
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [urgency, setUrgency] = useState('normal');
  const [doctorId, setDoctorId] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('appointments');
  const [pdfLoading, setPdfLoading] = useState(false);

  const { data: patient, isLoading, isError } = useQuery({
    queryKey: ['patients', id],
    queryFn: () => patientsApi.getOne(id!).then((res) => res.data),
    enabled: !!id,
  });

  const { data: doctors } = useQuery({
    queryKey: ['users', 'doctors'],
    queryFn: () => usersApi.getDoctors().then((res) => res.data),
  });

  const checkInMutation = useMutation({
    mutationFn: () => visitsApi.checkIn({ patientId: id, urgency, doctorId: doctorId || undefined }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'queue'] });
      navigate(`/clinical/triage/${res.data.id}`);
    },
  });

  // --- Tab data, only fetched once a patient id exists and its tab is active ---
  // appointmentsApi.getAll returns { data, total, page, limit, totalPages } —
  // it's paginated, not a flat array, so we unwrap .data.data here.
  const { data: appointmentsPage, isLoading: apptsLoading } = useQuery({
    queryKey: ['appointments', 'byPatient', id],
    queryFn: () => appointmentsApi.getAll({ patientId: id, limit: 50 }).then((res) => res.data),
    enabled: !!id && activeTab === 'appointments',
  });
  const appointments = appointmentsPage?.data ?? [];

  // Prescription has no direct patient FK — it hangs off Visit — so we
  // pull this patient's visits (with prescriptions eager-loaded) and
  // flatten them client-side.
  const { data: visitsWithRx, isLoading: rxLoading } = useQuery({
    queryKey: ['visits', 'byPatient', id],
    queryFn: () => visitsApi.getAll(undefined, id).then((res) => res.data),
    // Always enabled (not gated to the Prescriptions tab): the patient header's
    // "Create Invoice" button needs latestVisitId regardless of which tab is active.
    enabled: !!id,
  });
  const prescriptions = (visitsWithRx ?? []).flatMap((v: any) =>
    (v.prescriptions ?? []).map((p: any) => ({ ...p, visitNumber: v.visitNumber, visitDate: v.checkedInAt }))
  );

  const { data: labOrders, isLoading: labsLoading } = useQuery({
    queryKey: ['labOrders', 'byPatient', id],
    queryFn: () => labApi.getAll(undefined, id).then((res) => res.data),
    enabled: !!id && activeTab === 'labs',
  });

  const { data: radiologyOrders, isLoading: radiologyLoading } = useQuery({
    queryKey: ['radiologyOrders', 'byPatient', id],
    queryFn: () => radiologyApi.getAll(undefined, id).then((res) => res.data),
    enabled: !!id && activeTab === 'radiology',
  });

  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', 'byPatient', id],
    queryFn: () => billingApi.getAll(id).then((res) => res.data),
    enabled: !!id && activeTab === 'invoices',
  });
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);
  const consultationComplete = (visitsWithRx ?? []).some((v: any) => v.status === 'completed');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-clinical-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading patient…
      </div>
    );
  }

  if (isError || !patient) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg p-4">
        Couldn't load this patient.
      </div>
    );
  }

  const age = patient.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth).getTime()) / 3.15576e10)
    : null;

  const statusPill = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-600',
      dispensed: 'bg-green-100 text-green-700',
      ordered: 'bg-clinical-100 text-clinical-600',
      in_progress: 'bg-blue-100 text-blue-700',
      paid: 'bg-green-100 text-green-700',
      unpaid: 'bg-yellow-100 text-yellow-700',
    };
    return (
      <span className={`inline-flex text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${map[status] ?? 'bg-clinical-100 text-clinical-600'}`}>
        {status?.replace('_', ' ')}
      </span>
    );
  };


  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/patients')}
        className="flex items-center gap-1.5 text-sm text-clinical-500 hover:text-clinical-800"
      >
        <ArrowLeft size={15} /> Back to Patients
      </button>

      <div className="bg-white rounded-xl border border-clinical-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-full bg-primary-600 text-white flex items-center justify-center font-bold text-xl flex-shrink-0">
              {patient.firstName?.[0]}{patient.lastName?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-clinical-900">
                {[patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ')}
              </h1>
              <p className="text-clinical-500 text-sm mt-1">{patient.patientNumber}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-green-100 text-green-700 capitalize">
                  {patient.patientStatus}
                </span>
                <span className="inline-flex text-xs font-semibold px-2.5 py-1 rounded-full bg-clinical-100 text-clinical-600 capitalize">
                  {patient.patientType}
                </span>
              </div>
            </div>
          </div>

          {/* Check-in: creates a visit and sends the patient straight to Triage */}
          
        </div>
        {checkInMutation.isError && (
          <p className="text-red-600 text-xs mt-3">Couldn't check in this patient. Please try again.</p>
        )}
      </div>

      
      {/* Download Full Report — visible once a consultation is completed */}
      <div className="flex items-center justify-end mb-1">
        {consultationComplete ? (
          <button
            disabled={pdfLoading}
            onClick={async () => {
              setPdfLoading(true);
              try {
                const [freshLabOrders, freshInvoices, facilitySettings] = await Promise.all([
                  labApi.getAll(undefined, id).then((res) => res.data),
                  billingApi.getAll(id).then((res) => res.data),
                  facilityApi.get().then((res) => res.data).catch(() => null),
                ]);
                const logoAbsoluteUrl = facilitySettings?.logoUrl
                  ? `${api.defaults.baseURL}${facilitySettings.logoUrl}`
                  : undefined;
                const logoBase64 = await loadImageAsBase64(logoAbsoluteUrl);
                await generatePatientPDF(
                  patient,
                  visitsWithRx ?? [],
                  prescriptions ?? [],
                  freshLabOrders ?? [],
                  freshInvoices ?? [],
                  { ...(facilitySettings ?? {}), logoBase64 },
                );
              } catch (err: any) {
                console.error('PDF generation failed:', err);
                alert('Report generation failed: ' + (err?.message ?? String(err)));
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
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <h3 className="text-sm font-semibold text-clinical-800 mb-4">Personal Information</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-clinical-500">Age / Gender</span>
              <span className="font-medium text-clinical-800">{age ? `${age}y` : '—'} · <span className="capitalize">{patient.gender}</span></span>
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-500 flex items-center gap-1"><Droplet size={13} /> Blood Group</span>
              <span className="font-medium text-clinical-800">{patient.bloodGroup ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-500 flex items-center gap-1"><Phone size={13} /> Phone</span>
              <span className="font-medium text-clinical-800">{patient.phone ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-500 flex items-center gap-1"><MapPin size={13} /> Location</span>
              <span className="font-medium text-clinical-800">{[patient.city, patient.country].filter(Boolean).join(', ') || '—'}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <h3 className="text-sm font-semibold text-clinical-800 mb-4">Medical Information</h3>
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-clinical-500 mb-1">Allergies</p>
              {patient.allergies ? (
                <span className="inline-flex bg-red-50 text-red-600 text-xs font-semibold px-2 py-1 rounded-md">
                  {patient.allergies}
                </span>
              ) : (
                <span className="text-clinical-400">None recorded</span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-500">Insurance</span>
              <span className="font-medium text-clinical-800">{patient.insuranceCompany ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-clinical-500">Emergency Contact</span>
              <span className="font-medium text-clinical-800">
                {patient.emergencyContactName ? `${patient.emergencyContactName} (${patient.emergencyContactPhone ?? '—'})` : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {patient.notes && (
        <div className="bg-white rounded-xl border border-clinical-200 p-5">
          <h3 className="text-sm font-semibold text-clinical-800 mb-2">Notes</h3>
          <p className="text-sm text-clinical-600">{patient.notes}</p>
        </div>
      )}

      {/* ---- Tabs: Appointments / Prescriptions / Lab Results / Invoices ---- */}
      <div className="bg-white rounded-xl border border-clinical-200 overflow-hidden">
        <div className="flex border-b border-clinical-200">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                  active
                    ? 'border-primary-600 text-primary-600 bg-primary-50/40'
                    : 'border-transparent text-clinical-500 hover:text-clinical-800'
                }`}
              >
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'appointments' && (
            apptsLoading ? (
              <div className="text-sm text-clinical-400 py-6 text-center">Loading appointments…</div>
            ) : appointments.length === 0 ? (
              <div className="text-sm text-clinical-400 py-6 text-center">No appointments yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-clinical-400 border-b border-clinical-100">
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Details</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((a: any) => (
                    <tr key={a.id} className="border-b border-clinical-50 last:border-0">
                      <td className="py-3 pr-4">{new Date(a.appointmentDate).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">Dr. {a.doctor?.firstName} {a.doctor?.lastName}</td>
                      <td className="py-3 pr-4">{statusPill(a.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {activeTab === 'prescriptions' && (
            rxLoading ? (
              <div className="text-sm text-clinical-400 py-6 text-center">Loading prescriptions…</div>
            ) : prescriptions.length === 0 ? (
              <div className="text-sm text-clinical-400 py-6 text-center">No prescriptions yet.</div>
            ) : (
              <PrescriptionsTab prescriptions={prescriptions} navigate={navigate} />
            )
          )}

          {activeTab === 'labs' && (
            labsLoading ? (
              <div className="text-sm text-clinical-400 py-6 text-center">Loading lab results…</div>
            ) : (labOrders ?? []).length === 0 ? (
              <div className="text-sm text-clinical-400 py-6 text-center">No lab orders yet.</div>
            ) : (
              <LabOrdersTab labOrders={labOrders} navigate={navigate} />
            )
          )}

          {activeTab === 'radiology' && (
            radiologyLoading ? (
              <div className="text-sm text-clinical-400 py-6 text-center">Loading radiology results…</div>
            ) : (radiologyOrders ?? []).length === 0 ? (
              <div className="text-sm text-clinical-400 py-6 text-center">No radiology orders yet.</div>
            ) : (
              <RadiologyOrdersTab radiologyOrders={radiologyOrders} navigate={navigate} />
            )
          )}

          {activeTab === 'invoices' && (
            <div>
              <div className="mb-3 flex justify-end">
                <button
                  onClick={() => {
                    const latestVisitId = (visitsWithRx ?? [])[0]?.id;
                    const params = new URLSearchParams({ patientId: id ?? '' });
                    if (latestVisitId) params.set('visitId', latestVisitId);
                    navigate(`/billing/invoices/create?${params.toString()}`);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                >
                  Create Invoice
                </button>
              </div>
              {invoicesLoading ? (
                <div className="text-sm text-clinical-400 py-6 text-center">Loading invoices…</div>
              ) : (invoices ?? []).length === 0 ? (
                <div className="text-sm text-clinical-400 py-6 text-center">No invoices yet.</div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-clinical-400 border-b border-clinical-100">
                    <th className="py-2 pr-4 font-semibold">Invoice #</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Source</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b border-clinical-50 last:border-0">
                      <td className="py-3 pr-4">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                      <td className="py-3 pr-4 font-medium text-clinical-800">
                        ${Number(inv.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">
                        <InvoiceSourceBadges items={inv.items} />
                      </td>
                      <td className="py-3 pr-4">{statusPill(inv.status)}</td>
                      <td className="py-3 pr-4 text-right">
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          className="text-clinical-400 hover:text-clinical-600"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          )}
        </div>
      </div>
      {viewingInvoice && (
        <InvoiceModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}
    </div>
  );
}
