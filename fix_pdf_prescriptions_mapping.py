from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()

old = """  // 4. Prescriptions
  chk(45); secTitle('4. Prescriptions');
  if (prescriptions?.length) {
    autoTable(doc, {
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
  }"""

new = """  // 4. Prescriptions
  chk(45); secTitle('4. Prescriptions');
  if (prescriptions?.length) {
    autoTable(doc, {
      startY: y, margin: { left: mg, right: mg },
      head: [['Drug', 'Dose · Freq · Duration', 'Dispensed As', 'Qty', 'Status']],
      body: prescriptions.map((p: any) => [
        p.drugName ?? '—',
        [p.dose, p.frequency, p.duration].filter(Boolean).join(' · ') || '—',
        p.medicine?.name ? `${p.medicine.name}${p.medicine?.unit ? ` (${p.medicine.unit})` : ''}` : '—',
        p.quantity ?? '—',
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
  }"""

count = src.count(old)
if count == 0:
    print("WARN — Prescriptions block not found verbatim. Run:")
    print('  grep -n -A20 "4. Prescriptions" "' + str(TARGET) + '"')
    print("and paste the output.")
else:
    src = src.replace(old, new, 1)
    TARGET.write_text(src)
    print("OK — Prescriptions table now reads p.drugName, p.dose/frequency/duration, p.medicine.name/unit, p.quantity, p.status")
    print("SUCCESS — refresh the browser and click Download Full Report again.")
