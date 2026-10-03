#!/bin/bash
# ============================================================
# Billing auto-load fix — run from anywhere
# ============================================================
set -e

BACKEND="/Users/adminnopassword/Documents/Clinical MS/cms/backend/src"
FRONTEND="/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src"

echo ""
echo "══════════════════════════════════════════════"
echo "STEP 1 — Fix billing.service.ts: pharmacyItems"
echo "══════════════════════════════════════════════"
# Normalise the pharmacyItems return so each item has { name, qty, unitPrice }
python3 << 'PYEOF'
import pathlib

svc = pathlib.Path("/Users/adminnopassword/Documents/Clinical MS/cms/backend/src/billing/billing.service.ts")
text = svc.read_text()

# Fix pharmacyItems mapping (shape normalisation)
old = """    const pharmacyItems = prescriptions.map((p) => ({
      name: p.medicine?.name,
      unitPrice: Number(p.medicine?.sellPrice ?? 0),
      qty: p.quantity ?? 1,
    }));"""

new = """    const pharmacyItems = prescriptions.map((p) => ({
      name:      p.medicine?.name ?? 'Unknown medicine',
      unitPrice: Math.round(Number(p.medicine?.sellPrice ?? 0) * 100) / 100,
      qty:       p.quantity ?? 1,
    }));"""

if old in text:
    text = text.replace(old, new, 1)
    svc.write_text(text)
    print("  ✓ pharmacyItems shape normalised")
else:
    print("  ✓ pharmacyItems already correct (or shape differs — check manually)")
PYEOF

echo ""
echo "══════════════════════════════════════════════"
echo "STEP 2 — Fix billing.service.ts: return object"
echo "══════════════════════════════════════════════"
python3 << 'PYEOF'
import pathlib

svc = pathlib.Path("/Users/adminnopassword/Documents/Clinical MS/cms/backend/src/billing/billing.service.ts")
text = svc.read_text()

# Ensure the return object includes both pharmacyItems AND pharmacyTotal
# (some versions only return totals, not the item arrays)
if "pharmacyItems," not in text:
    old = "    return {"
    # Find the return block and check if pharmacyItems is already inside
    idx = text.rfind("    return {")
    if idx != -1:
        # Check what comes after
        snippet = text[idx:idx+400]
        if "pharmacyItems" not in snippet:
            # Inject pharmacyItems into the return object
            old2 = "      pharmacyTotal,"
            new2 = "      pharmacyItems,\n      pharmacyTotal,"
            if old2 in text:
                text = text.replace(old2, new2, 1)
                svc.write_text(text)
                print("  ✓ Added pharmacyItems to return object")
            else:
                print("  ⚠ Could not find pharmacyTotal in return — add pharmacyItems manually")
        else:
            print("  ✓ pharmacyItems already in return object")
    else:
        print("  ⚠ Could not find return block")
else:
    print("  ✓ pharmacyItems already exported in return")
PYEOF

echo ""
echo "══════════════════════════════════════════════"
echo "STEP 3 — billing.controller.ts: add GET endpoint"
echo "══════════════════════════════════════════════"
python3 << 'PYEOF'
import pathlib, re

ctrl = pathlib.Path("/Users/adminnopassword/Documents/Clinical MS/cms/backend/src/billing/billing.controller.ts")
text = ctrl.read_text()

if "getVisitSummary" in text:
    print("  ✓ Endpoint already exists")
else:
    # Add Get, Param to imports if missing
    if "Get," not in text:
        text = text.replace(
            "import { Controller,",
            "import { Controller, Get, Param,"
        )
        print("  ✓ Added Get, Param imports")

    # Inject route after class declaration
    text = text.replace(
        "export class BillingController {",
        """export class BillingController {

  @Get('visit/:visitId/summary')
  getVisitSummary(@Param('visitId') visitId: string) {
    return this.billingService.getVisitSummary(visitId);
  }
"""
    )
    ctrl.write_text(text)
    print("  ✓ Added GET /api/billing/visit/:visitId/summary")
PYEOF

echo ""
echo "══════════════════════════════════════════════"
echo "STEP 4 — api.ts: add billingApi.getVisitSummary"
echo "══════════════════════════════════════════════"
python3 << 'PYEOF'
import pathlib

api = pathlib.Path("/Users/adminnopassword/Documents/Clinical MS/cms/frontend/src/services/api.ts")
text = api.read_text()

if "getVisitSummary" in text:
    print("  ✓ Already present")
elif "billingApi" in text:
    text = text.replace(
        "export const billingApi = {",
        "export const billingApi = {\n  getVisitSummary: (visitId: string) => api.get(`/api/billing/visit/${visitId}/summary`),"
    )
    api.write_text(text)
    print("  ✓ Added getVisitSummary to existing billingApi")
else:
    text = text.rstrip() + """

export const billingApi = {
  getVisitSummary:  (visitId: string)      => api.get(`/api/billing/visit/${visitId}/summary`),
  createInvoice:    (data: any)             => api.post('/api/billing/invoices', data),
  getInvoices:      (params?: any)          => api.get('/api/billing/invoices', { params }),
  getInvoice:       (id: string)            => api.get(`/api/billing/invoices/${id}`),
  recordPayment:    (id: string, data: any) => api.post(`/api/billing/invoices/${id}/payments`, data),
};
"""
    api.write_text(text)
    print("  ✓ Created billingApi block")
PYEOF

echo ""
echo "══════════════════════════════════════════════"
echo "STEP 5 — Copy InvoiceAutoForm.tsx to frontend"
echo "══════════════════════════════════════════════"
mkdir -p "$FRONTEND/modules/billing"
cp /home/claude/InvoiceAutoForm.tsx "$FRONTEND/modules/billing/InvoiceAutoForm.tsx"
echo "  ✓ Copied InvoiceAutoForm.tsx"

echo ""
echo "══════════════════════════════════════════════"
echo "ALL PATCHES APPLIED"
echo "══════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo ""
echo "  1. Find your billing page (BillingPage.tsx / CreateInvoicePage.tsx)"
echo "     and replace the static form with:"
echo ""
echo "     import { InvoiceAutoForm } from '../modules/billing/InvoiceAutoForm';"
echo ""
echo "     <InvoiceAutoForm"
echo "       visitId={selectedVisitId}"
echo "       patientName={patient?.fullName ?? ''}"
echo "       onSave={async (items, notes) => {"
echo "         await billingApi.createInvoice({ visitId: selectedVisitId, items, notes });"
echo "         setShowInvoiceForm(false);"
echo "         refetchInvoices();"
echo "       }}"
echo "       onCancel={() => setShowInvoiceForm(false)}"
echo "     />"
echo ""
echo "  2. Restart backend:  cd backend && npm run start:dev"
echo "  3. Restart frontend: cd frontend && npm run dev"
echo ""
