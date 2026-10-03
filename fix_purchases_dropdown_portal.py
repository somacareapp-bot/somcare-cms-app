path = "frontend/src/modules/pharmacy/PurchasesPage.tsx"
with open(path) as f:
    lines = f.readlines()

# Replace the actions <td> block (original lines 416-505, 1-indexed)
start, end = 415, 505  # 0-indexed slice, end exclusive of 505 -> covers 416..505
new_block = '''                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end relative">
                        <button
                          onClick={() => setDetail(p)}
                          title="View"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setPrintTarget(p)}
                          title="Print"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <Printer size={15} />
                        </button>
                        <button
                          onClick={(e) => {
                            if (openMenuId === p.id) {
                              setOpenMenuId(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setMenuPos({ top: rect.bottom + 4, left: rect.right - 192 });
                            setOpenMenuId(p.id);
                          }}
                          title="More"
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-clinical-400 hover:text-clinical-700 hover:bg-clinical-100"
                        >
                          <MoreVertical size={15} />
                        </button>

                        {openMenuId === p.id && menuPos && createPortal(
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                            <div
                              className="fixed z-50 bg-white border border-clinical-200 rounded-lg shadow-lg py-1 w-48 text-left"
                              style={{ top: menuPos.top, left: menuPos.left }}
                            >
                              {p.status === 'pending' && (
                                <>
                                  <button
                                    onClick={() => { confirmMutation.mutate(p.id); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50"
                                  >
                                    <CheckCircle2 size={13} /> Confirm Receipt
                                  </button>
                                  <button
                                    onClick={() => { cancelMutation.mutate(p.id); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                  >
                                    <XCircle size={13} /> Cancel Purchase
                                  </button>
                                </>
                              )}
                              {isAdmin && p.approvalStatus === 'submitted' && (
                                <>
                                  <button
                                    onClick={() => { adminReviewMutation.mutate({ id: p.id, decision: 'approve' }); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-50"
                                  >
                                    <CheckCircle2 size={13} /> Approve (Admin Review)
                                  </button>
                                  <button
                                    onClick={() => {
                                      const reason = window.prompt('Rejection reason (optional):') || undefined;
                                      adminReviewMutation.mutate({ id: p.id, decision: 'reject', rejectionReason: reason });
                                    }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                                  >
                                    <XCircle size={13} /> Reject
                                  </button>
                                </>
                              )}
                              {(isAccountant || isAdmin) && p.approvalStatus === 'admin_approved' && p.dueAmount === 0 && (
                                <button
                                  onClick={() => markPaidMutation.mutate(p.id)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"
                                >
                                  <DollarSign size={13} /> Mark Paid (Close Out)
                                </button>
                              )}
                              {p.approvalStatus === 'admin_approved' && p.dueAmount > 0 && (
                                <p className="px-3 py-2 text-[11px] text-clinical-400">Settle balance to mark paid</p>
                              )}
                              {(isAdmin || isAccountant) && p.paymentStatus !== 'paid' && p.status !== 'cancelled' && (
                                <button
                                  onClick={() => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-primary-600 hover:bg-primary-50"
                                >
                                  <CreditCard size={13} /> Record Payment
                                </button>
                              )}
                              {p.status === 'pending' && p.paymentStatus === 'paid' && (
                                <p className="px-3 py-2 text-[11px] text-clinical-400">Confirm receipt to close out</p>
                              )}
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </td>
'''
lines[start:end] = [l + "\n" for l in new_block.split("\n")[:-1]]
content = "".join(lines)

# Add createPortal import
anchor_import = "} from 'lucide-react';\n"
if anchor_import not in content:
    raise SystemExit("import anchor not found")
content = content.replace(anchor_import, anchor_import + "import { createPortal } from 'react-dom';\n", 1)

# Add menuPos state next to openMenuId
anchor_state = "  const [openMenuId, setOpenMenuId] = useState<string | null>(null);\n"
if anchor_state not in content:
    raise SystemExit("state anchor not found")
content = content.replace(
    anchor_state,
    anchor_state + "  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);\n",
    1,
)

path_out = "frontend/src/modules/pharmacy/PurchasesPage.tsx"
with open(path_out, "w") as f:
    f.write(content)
print("Patched:", path_out)
