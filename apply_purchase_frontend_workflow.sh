#!/bin/bash
set -e

python3 << 'PYEOF'
import re, sys

def patch(path, replacements, label):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    for old, new in replacements:
        count = content.count(old)
        if count != 1:
            print(f"FAILED [{label}]: expected 1 match, found {count} for anchor starting: {old[:60]!r}")
            sys.exit(1)
        content = content.replace(old, new, 1)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Patched: {path}")

# ---------------------------------------------------------------------------
# 1. api.ts
# ---------------------------------------------------------------------------
api_path = "frontend/src/services/api.ts"
patch(api_path, [
    (
        "  cancelPurchase: (id: string) => api.patch(`/api/pharmacy/purchases/${id}/cancel`),\n",
        "  cancelPurchase: (id: string) => api.patch(`/api/pharmacy/purchases/${id}/cancel`),\n"
        "  adminReviewPurchase: (id: string, decision: 'approve' | 'reject', rejectionReason?: string) =>\n"
        "    api.patch(`/api/pharmacy/purchases/${id}/admin-review`, { decision, rejectionReason }),\n"
        "  markPurchasePaid: (id: string) => api.patch(`/api/pharmacy/purchases/${id}/mark-paid`),\n",
    ),
    (
        "  cancelLabSupplyPurchase: (id: string) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/cancel`),\n};",
        "  cancelLabSupplyPurchase: (id: string) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/cancel`),\n"
        "  adminReviewLabSupplyPurchase: (id: string, decision: 'approve' | 'reject', rejectionReason?: string) =>\n"
        "    api.patch(`/api/inventory/lab-supplies/purchases/${id}/admin-review`, { decision, rejectionReason }),\n"
        "  markLabSupplyPurchasePaid: (id: string) => api.patch(`/api/inventory/lab-supplies/purchases/${id}/mark-paid`),\n"
        "};",
    ),
], "api.ts")

# ---------------------------------------------------------------------------
# Shared page-patch builder (pharmacy vs lab supplies differ only in these)
# ---------------------------------------------------------------------------
def patch_purchases_page(path, api_name, query_key, fn_name, import_line):
    replacements = []

    # import useAuthStore
    replacements.append((
        import_line,
        import_line + "import { useAuthStore } from '../../stores/auth.store';\n",
    ))

    # interface: add approval fields
    replacements.append((
        "  status: 'pending' | 'confirmed' | 'cancelled';\n"
        "  paymentStatus: 'unpaid' | 'partial' | 'paid';\n"
        "  totalAmount: number;",
        "  status: 'pending' | 'confirmed' | 'cancelled';\n"
        "  paymentStatus: 'unpaid' | 'partial' | 'paid';\n"
        "  approvalStatus: 'submitted' | 'admin_approved' | 'rejected' | 'paid';\n"
        "  submittedByName?: string;\n"
        "  reviewedByName?: string;\n"
        "  reviewedAt?: string;\n"
        "  rejectionReason?: string;\n"
        "  paidByName?: string;\n"
        "  paidAt?: string;\n"
        "  totalAmount: number;",
    ))

    # APPROVAL_BADGE map
    replacements.append((
        "const PAYMENT_BADGE: Record<string, string> = {\n"
        "  paid: 'bg-green-100 text-green-700',\n"
        "  partial: 'bg-amber-100 text-amber-700',\n"
        "  unpaid: 'bg-red-100 text-red-600',\n"
        "};\n",
        "const PAYMENT_BADGE: Record<string, string> = {\n"
        "  paid: 'bg-green-100 text-green-700',\n"
        "  partial: 'bg-amber-100 text-amber-700',\n"
        "  unpaid: 'bg-red-100 text-red-600',\n"
        "};\n\n"
        "const APPROVAL_BADGE: Record<string, { label: string; cls: string }> = {\n"
        "  submitted: { label: 'Awaiting Admin Review', cls: 'bg-blue-100 text-blue-700' },\n"
        "  admin_approved: { label: 'Approved · Awaiting Payment', cls: 'bg-indigo-100 text-indigo-700' },\n"
        "  rejected: { label: 'Rejected', cls: 'bg-red-100 text-red-600' },\n"
        "  paid: { label: 'Paid & Closed', cls: 'bg-green-100 text-green-700' },\n"
        "};\n",
    ))

    # hasRole hook
    replacements.append((
        f"export function {fn_name}() {{\n  const queryClient = useQueryClient();\n",
        f"export function {fn_name}() {{\n  const queryClient = useQueryClient();\n"
        "  const { hasRole } = useAuthStore();\n"
        "  const isAdmin = hasRole('administrator');\n"
        "  const isAccountant = hasRole('accountant');\n",
    ))

    # new mutations, inserted right after paymentMutation
    payment_amount_fn = "recordPurchasePayment" if api_name == "pharmacyApi" else "recordLabSupplyPurchasePayment"
    replacements.append((
        "  const paymentMutation = useMutation({\n"
        f"    mutationFn: ({{ id, amount }}: {{ id: string; amount: number }}) => {api_name}.{payment_amount_fn}(id, amount),\n"
        "    onSuccess: () => {\n"
        f"      queryClient.invalidateQueries({{ queryKey: ['{query_key}'] }});\n"
        "      setPaymentTarget(null);\n"
        "      setPaymentAmount('');\n"
        "    },\n"
        "  });\n",
        "  const paymentMutation = useMutation({\n"
        f"    mutationFn: ({{ id, amount }}: {{ id: string; amount: number }}) => {api_name}.{payment_amount_fn}(id, amount),\n"
        "    onSuccess: () => {\n"
        f"      queryClient.invalidateQueries({{ queryKey: ['{query_key}'] }});\n"
        "      setPaymentTarget(null);\n"
        "      setPaymentAmount('');\n"
        "    },\n"
        "  });\n\n"
        "  const adminReviewMutation = useMutation({\n"
        "    mutationFn: ({ id, decision, rejectionReason }: { id: string; decision: 'approve' | 'reject'; rejectionReason?: string }) =>\n"
        f"      {api_name}.adminReview{'Purchase' if api_name == 'pharmacyApi' else 'LabSupplyPurchase'}(id, decision, rejectionReason),\n"
        "    onSuccess: () => {\n"
        f"      queryClient.invalidateQueries({{ queryKey: ['{query_key}'] }});\n"
        "      setOpenMenuId(null);\n"
        "    },\n"
        "  });\n\n"
        "  const markPaidMutation = useMutation({\n"
        f"    mutationFn: (id: string) => {api_name}.mark{'Purchase' if api_name == 'pharmacyApi' else 'LabSupplyPurchase'}Paid(id),\n"
        "    onSuccess: () => {\n"
        f"      queryClient.invalidateQueries({{ queryKey: ['{query_key}'] }});\n"
        "      setOpenMenuId(null);\n"
        "    },\n"
        "  });\n",
    ))

    # table header: add Approval column
    replacements.append((
        '                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Status</th>\n'
        '                  <th className="px-4 py-3" />',
        '                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Status</th>\n'
        '                  <th className="text-left px-4 py-3 text-xs font-bold text-clinical-500 uppercase tracking-wide">Approval</th>\n'
        '                  <th className="px-4 py-3" />',
    ))

    # table row: add Approval badge cell
    replacements.append((
        '                    <td className="px-4 py-3">\n'
        '                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${PAYMENT_BADGE[p.paymentStatus]}`}>\n'
        '                        {p.paymentStatus}\n'
        '                      </span>\n'
        '                    </td>\n'
        '                    <td className="px-4 py-3">\n'
        '                      <div className="flex items-center gap-1.5 justify-end relative">',
        '                    <td className="px-4 py-3">\n'
        '                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold capitalize ${PAYMENT_BADGE[p.paymentStatus]}`}>\n'
        '                        {p.paymentStatus}\n'
        '                      </span>\n'
        '                    </td>\n'
        '                    <td className="px-4 py-3">\n'
        '                      <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${APPROVAL_BADGE[p.approvalStatus]?.cls ?? \'bg-clinical-100 text-clinical-500\'}`}>\n'
        '                        {APPROVAL_BADGE[p.approvalStatus]?.label ?? p.approvalStatus}\n'
        '                      </span>\n'
        '                      {p.approvalStatus === \'rejected\' && p.rejectionReason && (\n'
        '                        <p className="text-[10px] text-red-500 mt-0.5 max-w-[160px] truncate" title={p.rejectionReason}>{p.rejectionReason}</p>\n'
        '                      )}\n'
        '                    </td>\n'
        '                    <td className="px-4 py-3">\n'
        '                      <div className="flex items-center gap-1.5 justify-end relative">',
    ))

    # dropdown menu: add Admin Review / Mark Paid actions
    replacements.append((
        "                            )}\n"
        "                            {p.paymentStatus !== 'paid' && p.status !== 'cancelled' && (\n"
        "                              <button\n"
        "                                onClick={() => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); }}\n"
        '                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"\n'
        "                              >\n"
        "                                <CreditCard size={13} /> Record Payment\n"
        "                              </button>\n"
        "                            )}",
        "                            )}\n"
        "                            {isAdmin && p.approvalStatus === 'submitted' && (\n"
        "                              <>\n"
        "                                <button\n"
        "                                  onClick={() => { adminReviewMutation.mutate({ id: p.id, decision: 'approve' }); }}\n"
        '                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50"\n'
        "                                >\n"
        "                                  <CheckCircle2 size={13} /> Approve (Admin Review)\n"
        "                                </button>\n"
        "                                <button\n"
        "                                  onClick={() => {\n"
        "                                    const reason = window.prompt('Rejection reason (optional):') || undefined;\n"
        "                                    adminReviewMutation.mutate({ id: p.id, decision: 'reject', rejectionReason: reason });\n"
        "                                  }}\n"
        '                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"\n'
        "                                >\n"
        "                                  <XCircle size={13} /> Reject\n"
        "                                </button>\n"
        "                              </>\n"
        "                            )}\n"
        "                            {(isAccountant || isAdmin) && p.approvalStatus === 'admin_approved' && p.dueAmount === 0 && (\n"
        "                              <button\n"
        "                                onClick={() => markPaidMutation.mutate(p.id)}\n"
        '                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"\n'
        "                              >\n"
        "                                <DollarSign size={13} /> Mark Paid (Close Out)\n"
        "                              </button>\n"
        "                            )}\n"
        "                            {p.approvalStatus === 'admin_approved' && p.dueAmount > 0 && (\n"
        '                              <p className="px-3 py-2 text-[11px] text-clinical-400">Settle balance to mark paid</p>\n'
        "                            )}\n"
        "                            {p.paymentStatus !== 'paid' && p.status !== 'cancelled' && (\n"
        "                              <button\n"
        "                                onClick={() => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); }}\n"
        '                                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"\n'
        "                              >\n"
        "                                <CreditCard size={13} /> Record Payment\n"
        "                              </button>\n"
        "                            )}",
    ))

    patch(path, replacements, path)

patch_purchases_page(
    "frontend/src/modules/pharmacy/PurchasesPage.tsx",
    api_name="pharmacyApi",
    query_key="pharmacy",
    fn_name="PurchasesPage",
    import_line="import { pharmacyApi } from '../../services/api';\n",
)

patch_purchases_page(
    "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx",
    api_name="inventoryApi",
    query_key="inventory",
    fn_name="LabSuppliesPurchasesPage",
    import_line="import { inventoryApi } from '../../services/api';\n",
)

print("\nAll files patched successfully.")
PYEOF
