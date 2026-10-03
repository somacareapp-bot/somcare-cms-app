from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()

old = """            onClick={async () => {
              setPdfLoading(true);
              try {
                await generatePatientPDF(patient, appointments ?? [], prescriptions ?? [], labs ?? [], invoices ?? []);
              } finally {
                setPdfLoading(false);
              }
            }}"""

new = """            onClick={async () => {
              setPdfLoading(true);
              try {
                await generatePatientPDF(patient, visitsWithRx ?? [], prescriptions ?? [], labOrders ?? [], invoices ?? []);
              } catch (err: any) {
                console.error('PDF generation failed:', err);
                alert('Report generation failed: ' + (err?.message ?? String(err)));
              } finally {
                setPdfLoading(false);
              }
            }}"""

count = src.count(old)
if count == 0:
    print("WARN — exact onClick block not found. Run this and paste the output:")
    print('  grep -n -B2 -A10 "generatePatientPDF(patient" "' + str(TARGET) + '"')
else:
    src = src.replace(old, new)
    TARGET.write_text(src)
    print(f"OK — patched {count} occurrence(s). The button now:")
    print("  1. Uses visitsWithRx/labOrders (the actual variable names in this file) instead of the")
    print("     undefined 'appointments'/'labs' names, which likely threw a ReferenceError silently")
    print("  2. Shows an alert() + console.error if generation still fails, so we can see the real cause")
    print("SUCCESS — refresh the browser, click Download Full Report again, and share whatever the alert says.")
