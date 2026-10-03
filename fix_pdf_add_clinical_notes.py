from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()
ok = True

# 1. Insert a new "Clinical Notes" section right after Medical Information (section 2),
#    pulling from the most recent completed visit in `appointments` (which is actually visitsWithRx).
old_anchor = """  // 3. Lab Results
  chk(45); secTitle('3. Lab Results');"""

new_block = """  // 3. Clinical Notes
  const latestCompletedVisit = (appointments ?? [])
    .filter((v: any) => v.status === 'completed')
    .sort((a: any, b: any) => new Date(b.checkedInAt ?? b.createdAt ?? 0).getTime() - new Date(a.checkedInAt ?? a.createdAt ?? 0).getTime())[0];
  chk(45); secTitle('3. Clinical Notes');
  if (latestCompletedVisit) {
    const noteBlock = (label: string, val: string | null | undefined) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...dark);
      doc.text(label, mg + 2, y); y += 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...mid);
      const lines = doc.splitTextToSize(val && val.trim() ? val : '—', cw - 4);
      doc.text(lines, mg + 2, y);
      y += lines.length * 4.5 + 4;
      chk(20);
    };
    noteBlock('Chief Complaint', latestCompletedVisit.chiefComplaint);
    noteBlock('History of Present Illness', latestCompletedVisit.historyOfPresentIllness);
    noteBlock('Examination Findings', latestCompletedVisit.examinationFindings);
    noteBlock('Diagnosis', latestCompletedVisit.diagnosis);
  } else {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...mid);
    doc.text('No clinical notes recorded.', mg + 2, y); y += 8;
  }

  // 4. Lab Results
  chk(45); secTitle('4. Lab Results');"""

if old_anchor in src:
    src = src.replace(old_anchor, new_block, 1)
    print("OK — Clinical Notes section inserted (Chief Complaint, HPI, Examination Findings, Diagnosis)")
else:
    ok = False
    print("WARN — Lab Results section anchor not found verbatim")

# 2. Renumber the remaining sections so it reads 1..6 cleanly
renumbers = [
    ("secTitle('4. Prescriptions');", "secTitle('5. Prescriptions');"),
    ("secTitle('5. Invoices');", "secTitle('6. Invoices');"),
]
for old_s, new_s in renumbers:
    if old_s in src:
        src = src.replace(old_s, new_s, 1)
    else:
        print(f"WARN — could not find '{old_s}' to renumber (non-fatal, just a label)")

if ok:
    TARGET.write_text(src)
    print("SUCCESS — refresh the browser and click Download Full Report again.")
    print("Note: this pulls notes from the most recently completed visit. If a patient has multiple")
    print("completed visits, only the latest one's notes are shown (matches a single consultation report).")
else:
    print("Nothing was written — the Lab Results anchor didn't match. Run:")
    print('  grep -n "3. Lab Results" "' + str(TARGET) + '"')
    print("and paste the output.")
