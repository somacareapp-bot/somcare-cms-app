from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()
ok = True

# 1. Fix emergency contact field names
old_ec = """  row('Emergency Contact', patient.emergencyContact
    ? `${patient.emergencyContact}${patient.emergencyPhone ? ` (${patient.emergencyPhone})` : ''}`
    : '—');"""
new_ec = """  row('Emergency Contact', patient.emergencyContactName
    ? `${patient.emergencyContactName}${patient.emergencyContactPhone ? ` (${patient.emergencyContactPhone})` : ''}`
    : '—');"""
if old_ec in src:
    src = src.replace(old_ec, new_ec, 1)
    print("OK — emergency contact fields fixed")
else:
    ok = False
    print("WARN — emergency contact block not found verbatim")

# 2. Fix Lab Results section to flatten labOrders[].items[]
old_labs = """  // 3. Lab Results
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
  }"""

new_labs = """  // 3. Lab Results
  chk(45); secTitle('3. Lab Results');
  const labRows = (labs ?? []).flatMap((o: any) =>
    (o.items ?? []).map((item: any) => [
      o.labOrderNumber ?? '—',
      item.testName ?? '—',
      item.resultValue ?? '—',
      item.unit ?? '—',
      item.referenceRange ?? '—',
      item.flag && item.flag !== 'normal' ? String(item.flag).toUpperCase() : '—',
    ])
  );
  if (labRows.length) {
    (doc as any).autoTable({
      startY: y, margin: { left: mg, right: mg },
      head: [['Order #', 'Test', 'Result', 'Unit', 'Reference', 'Flag']],
      body: labRows,
      headStyles: { fillColor: brand, fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      alternateRowStyles: { fillColor: [250, 250, 250] },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No lab results recorded.', mg + 2, y); y += 8;
  }"""

if old_labs in src:
    src = src.replace(old_labs, new_labs, 1)
    print("OK — lab results section now flattens labOrders[].items[]")
else:
    ok = False
    print("WARN — lab results block not found verbatim")

# 3. Fix the button's onClick to fetch fresh labOrders + invoices at click time
old_click = """              try {
                await generatePatientPDF(patient, visitsWithRx ?? [], prescriptions ?? [], labOrders ?? [], invoices ?? []);
              } catch (err: any) {"""
new_click = """              try {
                const [freshLabOrders, freshInvoices] = await Promise.all([
                  labApi.getAll(undefined, id).then((res) => res.data),
                  billingApi.getAll(id).then((res) => res.data),
                ]);
                await generatePatientPDF(patient, visitsWithRx ?? [], prescriptions ?? [], freshLabOrders ?? [], freshInvoices ?? []);
              } catch (err: any) {"""
if old_click in src:
    src = src.replace(old_click, new_click, 1)
    print("OK — button now fetches fresh lab orders + invoices directly from the API before generating")
else:
    ok = False
    print("WARN — onClick block not found verbatim. Run:")
    print('  grep -n -B2 -A6 "generatePatientPDF(patient" "' + str(TARGET) + '"')

if ok:
    TARGET.write_text(src)
    print("SUCCESS — refresh the browser and click Download Full Report again.")
else:
    print("Nothing was written — one or more blocks did not match. Paste the requested grep output.")
