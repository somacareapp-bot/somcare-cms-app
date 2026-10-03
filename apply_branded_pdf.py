import re, sys, pathlib

TARGET = pathlib.Path("frontend/src/modules/patients/PatientDetailPage.tsx")
NEW_FN = pathlib.Path("generatePatientPDF.branded.ts")

START_MARKER = "async function generatePatientPDF("
END_MARKER = "doc.save(`${pid}_consultation_report.pdf`);"

src = TARGET.read_text()
new_fn_src = NEW_FN.read_text()

start = src.find(START_MARKER)
if start == -1:
    sys.exit("FAIL — could not find start of generatePatientPDF()")

end_marker_pos = src.find(END_MARKER, start)
if end_marker_pos == -1:
    sys.exit("FAIL — could not find end of generatePatientPDF() (doc.save line)")

# advance past the end marker line + the closing brace + newline
close_brace = src.find("\n}", end_marker_pos)
if close_brace == -1:
    sys.exit("FAIL — could not find closing brace after doc.save()")
end = close_brace + len("\n}")

# strip the big comment block header from the new file, keep from
# "async function generatePatientPDF(" onward
new_start = new_fn_src.find(START_MARKER)
if new_start == -1:
    sys.exit("FAIL — new function file missing start marker")
new_fn_body = new_fn_src[new_start:].rstrip() + "\n"

patched = src[:start] + new_fn_body + src[end:]
TARGET.write_text(patched)

print("OK — generatePatientPDF() replaced with the branded SOMCARE-style version")
print("SUCCESS — refresh the browser and click Download Full Report again.")
