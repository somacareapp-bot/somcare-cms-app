from pathlib import Path

def patch(path: Path, old: str, new: str, label: str):
    src = path.read_text()
    count = src.count(old)
    if count != 1:
        print(f"SKIP — {label} (expected 1 match, found {count})")
        return
    path.write_text(src.replace(old, new))
    print(f"OK — {label}")

root = Path(".")
page = root / "frontend/src/modules/patients/PatientDetailPage.tsx"

old_fn = """  // "Approved and Verified by" block — used at the end of every section,
  // each with the role responsible for that section's content.
  // Left: who approved it, in plain text. Middle: the rendered signature.
  // Right: date/time.
  function approvalBlock(sectionTitle: string, role: string, name?: string) {
    chk(sectionTitle, 32);
    y += 10;

    const sigX = mg + 78;
    const sigW = 60;

    // Left — plain-text identity of the approver
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text('Approved and Verified by', mg, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...dark);
    doc.text(name ?? '\\u2014', mg, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
    doc.text(role, mg, y + 10.5);

    // Middle — the rendered signature graphic
    if (name) {
      registerSignatureFont(doc);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...mid);
      doc.text('DocuSigned by', sigX, y - 4);
      doc.setFont('Sacramento', 'normal'); doc.setFontSize(16); doc.setTextColor(...brand);
      doc.text(name, sigX, y + 1);
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...mid);
      doc.text('Not yet signed', sigX, y + 1);
    }
    doc.setDrawColor(...mid); doc.setLineWidth(0.3);
    doc.line(sigX - 1, y + 4, sigX - 1 + sigW, y + 4);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...mid);
    doc.text('Signature', sigX, y + 8);

    // Right — date/time
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text('Date', pw - mg - 40, y);
    doc.text('Time', pw - mg - 16, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mid);
    doc.text(dateStr, pw - mg - 40, y + 6);
    doc.text(timeStr, pw - mg - 16, y + 6);
    doc.setDrawColor(...mid); doc.setLineWidth(0.3);
    doc.line(pw - mg - 40, y + 9, pw - mg, y + 9);

    y += 20;
  }"""

new_fn = """  // "Approved and Verified by" block — used at the end of every section,
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
    doc.text(name ?? '\\u2014', mg, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
    doc.text(role, mg, y + 10.5);

    // Right, above the line — the rendered signature
    if (name) {
      registerSignatureFont(doc);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...mid);
      doc.text('DocuSigned by', rightX, y - 4);
      doc.setFont('Sacramento', 'normal'); doc.setFontSize(16); doc.setTextColor(...brand);
      doc.text(name, rightX, y + 1);
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
  }"""

patch(page, old_fn, new_fn, "approvalBlock(): collapsed to 2 columns — left name/role, right signature-over-date/time")

print("\nApplies to all four sections (Clinical, Laboratory, Prescriptions, Invoices)")
print("since they all share this one approvalBlock() function.")
print("Refresh and regenerate a report to see the new layout.")
