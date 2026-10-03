from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()

old = "  const consultationComplete = (appointments ?? []).some((a: any) => a.status === 'completed');\n"
new = "  const consultationComplete = (visitsWithRx ?? []).some((v: any) => v.status === 'completed');\n"

count = src.count(old)
if count == 0:
    print("WARN — old consultationComplete line not found verbatim. Run:")
    print("  grep -n \"consultationComplete\" \"" + str(TARGET) + "\"")
    print("and paste the output so the line can be matched exactly.")
else:
    src = src.replace(old, new)
    TARGET.write_text(src)
    print(f"OK — replaced {count} occurrence(s): consultationComplete now checks visitsWithRx (visit.status), not appointments")
    print("SUCCESS — refresh the browser. The Download Full Report button should now appear once the doctor clicks Complete Consultation in the queue.")
