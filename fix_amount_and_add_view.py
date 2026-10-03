"""
Run this on your machine:
    python3 fix_amount_and_add_view.py

Does three things:
1. Exports `Invoice` type and `InvoiceModal` from InvoicesPage.tsx (currently
   private to that file) so they can be reused elsewhere.
2. In PatientDetailPage.tsx: fixes the Amount column to read `inv.total`
   (the entity's actual field) instead of the nonexistent
   `inv.totalAmount`/`inv.amount`.
3. Adds a "View" (eye icon) button per invoice row that opens the same
   InvoiceModal used on the main Invoices page.
"""
import pathlib
import sys

INVOICES_PAGE = pathlib.Path(
    "/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/billing/InvoicesPage.tsx"
)
PATIENT_PAGE = pathlib.Path(
    "/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/modules/patients/PatientDetailPage.tsx"
)


def require(text, old, step, path):
    if old not in text:
        print(f"{step} PATTERN NOT FOUND in {path.name} — aborting. Paste back current content of that section.")
        sys.exit(1)


# ---------------------------------------------------------------------------
# PART A — InvoicesPage.tsx: export the type and the modal
# ---------------------------------------------------------------------------
inv_text = INVOICES_PAGE.read_text()
inv_original = inv_text

old_type = "interface Invoice {"
new_type = "export interface Invoice {"
require(inv_text, old_type, "A1", INVOICES_PAGE)
inv_text = inv_text.replace(old_type, new_type, 1)

old_modal = "function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {"
new_modal = "export function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {"
require(inv_text, old_modal, "A2", INVOICES_PAGE)
inv_text = inv_text.replace(old_modal, new_modal, 1)

if inv_text != inv_original:
    INVOICES_PAGE.write_text(inv_text)
    print(f"SUCCESS — {INVOICES_PAGE.name} now exports Invoice and InvoiceModal.")

# ---------------------------------------------------------------------------
# PART B — PatientDetailPage.tsx: import modal, fix Amount, add View button
# ---------------------------------------------------------------------------
pt_text = PATIENT_PAGE.read_text()
pt_original = pt_text

# B1: add the import
old_import = "import { patientsApi, visitsApi, usersApi, appointmentsApi, labApi, billingApi } from '../../services/api';"
new_import = """import { patientsApi, visitsApi, usersApi, appointmentsApi, labApi, billingApi } from '../../services/api';
import { InvoiceModal } from '../billing/InvoicesPage';"""
require(pt_text, old_import, "B1", PATIENT_PAGE)
pt_text = pt_text.replace(old_import, new_import, 1)

# B2: add Eye icon to the lucide-react import
old_icons = "import { ArrowLeft, Loader2, Phone, MapPin, Droplet, LogIn, Calendar, Pill, FlaskConical, Receipt } from 'lucide-react';"
new_icons = "import { ArrowLeft, Loader2, Phone, MapPin, Droplet, LogIn, Calendar, Pill, FlaskConical, Receipt, Eye } from 'lucide-react';"
require(pt_text, old_icons, "B2", PATIENT_PAGE)
pt_text = pt_text.replace(old_icons, new_icons, 1)

# B3: add `viewingInvoice` state. Insert right after the component's other
# useState-based state — easiest stable anchor is right before the tabs/data
# queries block; we'll instead just add it near the top of the component body.
# We anchor on the invoices query itself since it's unique and nearby.
old_invoices_query = """  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', 'byPatient', id],
    queryFn: () => billingApi.getAll(id).then((res) => res.data),
    enabled: !!id && activeTab === 'invoices',
  });"""
new_invoices_query = """  const { data: invoices, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', 'byPatient', id],
    queryFn: () => billingApi.getAll(id).then((res) => res.data),
    enabled: !!id && activeTab === 'invoices',
  });
  const [viewingInvoice, setViewingInvoice] = useState<any | null>(null);"""
require(pt_text, old_invoices_query, "B3", PATIENT_PAGE)
pt_text = pt_text.replace(old_invoices_query, new_invoices_query, 1)

# B4: fix the table header (add Actions column) and body (fix Amount, add View button)
old_table = """              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-clinical-400 border-b border-clinical-100">
                    <th className="py-2 pr-4 font-semibold">Invoice #</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b border-clinical-50 last:border-0">
                      <td className="py-3 pr-4">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                      <td className="py-3 pr-4 font-medium text-clinical-800">{inv.totalAmount ?? inv.amount}</td>
                      <td className="py-3 pr-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{statusPill(inv.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>"""

new_table = """              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-clinical-400 border-b border-clinical-100">
                    <th className="py-2 pr-4 font-semibold">Invoice #</th>
                    <th className="py-2 pr-4 font-semibold">Amount</th>
                    <th className="py-2 pr-4 font-semibold">Date</th>
                    <th className="py-2 pr-4 font-semibold">Status</th>
                    <th className="py-2 pr-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => (
                    <tr key={inv.id} className="border-b border-clinical-50 last:border-0">
                      <td className="py-3 pr-4">{inv.invoiceNumber ?? inv.id.slice(0, 8)}</td>
                      <td className="py-3 pr-4 font-medium text-clinical-800">
                        ${Number(inv.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 pr-4">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 pr-4">{statusPill(inv.status)}</td>
                      <td className="py-3 pr-4 text-right">
                        <button
                          onClick={() => setViewingInvoice(inv)}
                          className="text-clinical-400 hover:text-clinical-600"
                          title="View"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>"""

require(pt_text, old_table, "B4", PATIENT_PAGE)
pt_text = pt_text.replace(old_table, new_table, 1)

# B5: render the modal at the end of the component, right before the final closing tags.
old_end = """        </div>
      </div>
    </div>
  );
}"""
new_end = """        </div>
      </div>
      {viewingInvoice && (
        <InvoiceModal invoice={viewingInvoice} onClose={() => setViewingInvoice(null)} />
      )}
    </div>
  );
}"""
require(pt_text, old_end, "B5", PATIENT_PAGE)
pt_text = pt_text.replace(old_end, new_end, 1)

if pt_text == pt_original:
    print("NO CHANGES MADE to PatientDetailPage.tsx.")
    sys.exit(1)

PATIENT_PAGE.write_text(pt_text)
print(f"SUCCESS — {PATIENT_PAGE.name} updated (Amount fixed, View button + modal added).")
print("Restart the frontend dev server if it doesn't hot-reload cleanly.")
