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
  function approvalBlock(sectionTitle: string, role: string, name?: string) {
    chk(sectionTitle, 32);
    y += 10;

    if (name) {
      registerSignatureFont(doc);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(...mid);
      doc.text('DocuSigned by', mg + 1, y - 5);
      doc.setFont('Sacramento', 'normal'); doc.setFontSize(16); doc.setTextColor(...brand);
      doc.text(name, mg + 1, y);
    } else {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...mid);
      doc.text('Not yet signed', mg + 1, y);
    }

    doc.setDrawColor(...mid); doc.setLineWidth(0.3);
    doc.line(mg, y + 3, mg + 75, y + 3);
    doc.line(pw - mg - 55, y + 3, pw - mg, y + 3);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...dark);
    doc.text('Approved and Verified by', mg, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...mid);
    doc.text(role, mg, y + 12);

    const now = new Date();
    const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...dark);
    doc.text('Date', pw - mg - 55, y + 8);
    doc.text('Time', pw - mg - 22, y + 8);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...mid);
    doc.text(dateStr, pw - mg - 55, y + 12);
    doc.text(timeStr, pw - mg - 22, y + 12);

    y += 20;
  }"""

new_fn = """  // "Approved and Verified by" block — used at the end of every section,
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

patch(page, old_fn, new_fn, "approvalBlock(): restructured into left (name/role) / middle (signature) / right (date-time)")

print("\nApplies to all four sections automatically — Clinical, Laboratory, Prescriptions,")
print("and Invoices all call this same approvalBlock() function.")
print("Refresh and regenerate a report to see the new layout.")
