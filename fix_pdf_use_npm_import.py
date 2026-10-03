from pathlib import Path

TARGET = Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx")
src = TARGET.read_text()

# 1. Add static imports near the top of the file, right after the last existing import
import_anchor = "import { patientsApi, visitsApi, usersApi, appointmentsApi, labApi, billingApi } from '../../services/api';\n"
new_imports = (
    import_anchor
    + "import { jsPDF } from 'jspdf';\n"
    + "import autoTable from 'jspdf-autotable';\n"
)

if import_anchor not in src:
    print("WARN — import anchor line not found. Run:")
    print('  grep -n "from \'../../services/api\'" "' + str(TARGET) + '"')
    print("and paste the output.")
else:
    src = src.replace(import_anchor, new_imports, 1)

    # 2. Remove the CDN-loading block inside generatePatientPDF
    old_loader = """  // Lazy-load jsPDF + autoTable from CDN so no extra npm dep is needed
  if (!(window as any).jspdf) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js';
      s.onload = () => resolve(); s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  const { jsPDF } = (window as any).jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });"""

    new_loader = "  const doc = new jsPDF({ unit: 'mm', format: 'a4' });"

    if old_loader not in src:
        print("WARN — CDN loader block not found verbatim (whitespace may differ). Run:")
        print('  grep -n -A20 "generatePatientPDF" "' + str(TARGET) + '" | head -30')
        print("and paste the output so the exact block can be matched.")
    else:
        src = src.replace(old_loader, new_loader, 1)

        # 3. Any doc.autoTable(...) calls need to become autoTable(doc, ...)
        src = src.replace("doc.autoTable(", "autoTable(doc, ")

        TARGET.write_text(src)
        print("OK — CDN script loading removed; jsPDF/autoTable now come from the npm packages")
        print("OK — doc.autoTable(...) calls rewritten to autoTable(doc, ...) for the ESM import style")
        print("SUCCESS — restart your frontend dev server (it needs to pick up the new imports/deps),")
        print("then refresh the browser and click Download Full Report again.")
