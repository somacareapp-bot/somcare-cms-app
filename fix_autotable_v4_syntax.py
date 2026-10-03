from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()

old = "(doc as any).autoTable({"
new = "autoTable(doc, {"

count = src.count(old)
if count == 0:
    print("WARN — pattern '(doc as any).autoTable({' not found. Run:")
    print('  grep -n "autoTable" "' + str(TARGET) + '"')
    print("and paste the output.")
else:
    src = src.replace(old, new)
    TARGET.write_text(src)
    print(f"OK — replaced {count} occurrence(s) of (doc as any).autoTable({{ with autoTable(doc, {{")
    print("doc.lastAutoTable.finalY calls are untouched and still work the same way.")
    print("SUCCESS — refresh the browser and click Download Full Report again.")
