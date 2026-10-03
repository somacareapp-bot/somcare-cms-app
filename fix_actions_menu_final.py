import re

paths = [
    "frontend/src/modules/pharmacy/PurchasesPage.tsx",
    "frontend/src/modules/inventory/LabSuppliesPurchasesPage.tsx",
]

for path in paths:
    with open(path) as f:
        content = f.read()

    # Find the whole actions <td> block: from the opening <td> that contains
    # the View button through to its matching closing </td>.
    start_marker = '                    <td className="px-4 py-3">\n                      <div className="flex items-center gap-1.5 justify-end relative">\n                        <button\n                          onClick={() => setDetail(p)}'
    if start_marker not in content:
        # Already patched to sticky variant in an earlier attempt? try that too.
        start_marker = '                    <td className="px-4 py-3 sticky right-0 bg-white group-hover:bg-clinical-50">\n                      <div className="flex items-center gap-1.5 justify-end relative">\n                        <button\n                          onClick={() => setDetail(p)}'
    start_idx = content.find(start_marker)
    if start_idx == -1:
        raise SystemExit(f"Could not find actions <td> start in {path}")

    # Find the end: the next "</tr>" after start_idx marks end of row; the </td>
    # right before it is what we want.
    tr_close_idx = content.find("</tr>", start_idx)
    if tr_close_idx == -1:
        raise SystemExit(f"Could not find </tr> after actions td in {path}")
    # Walk back to the </td> just before </tr>
    td_close_idx = content.rfind("</td>", start_idx, tr_close_idx)
    end_idx = td_close_idx + len("</td>")

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
                            const menuHeight = 220;
                            const spaceBelow = window.innerHeight - rect.bottom;
                            const top = spaceBelow < menuHeight ? rect.top - menuHeight - 4 : rect.bottom + 4;
                            setMenuPos({ top: Math.max(8, top), left: Math.min(rect.right - 192, window.innerWidth - 200) });
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
                              {(() => {
                                const actions: { label: string; icon: any; onClick: () => void; className: string }[] = [];
                                if (p.status === 'pending') {
                                  actions.push({
                                    label: 'Confirm Receipt', icon: CheckCircle2,
                                    onClick: () => { confirmMutation.mutate(p.id); setOpenMenuId(null); },
                                    className: 'text-green-700 hover:bg-green-50',
                                  });
                                  actions.push({
                                    label: 'Cancel Purchase', icon: XCircle,
                                    onClick: () => { cancelMutation.mutate(p.id); setOpenMenuId(null); },
                                    className: 'text-red-600 hover:bg-red-50',
                                  });
                                }
                                if (isAdmin && p.approvalStatus === 'submitted') {
                                  actions.push({
                                    label: 'Approve (Admin Review)', icon: CheckCircle2,
                                    onClick: () => { adminReviewMutation.mutate({ id: p.id, decision: 'approve' }); },
                                    className: 'text-green-700 hover:bg-green-50',
                                  });
                                  actions.push({
                                    label: 'Reject', icon: XCircle,
                                    onClick: () => {
                                      const reason = window.prompt('Rejection reason (optional):') || undefined;
                                      adminReviewMutation.mutate({ id: p.id, decision: 'reject', rejectionReason: reason });
                                    },
                                    className: 'text-red-600 hover:bg-red-50',
                                  });
                                }
                                if ((isAccountant || isAdmin) && p.approvalStatus === 'admin_approved' && p.dueAmount === 0) {
                                  actions.push({
                                    label: 'Mark Paid (Close Out)', icon: DollarSign,
                                    onClick: () => markPaidMutation.mutate(p.id),
                                    className: 'text-primary-600 hover:bg-primary-50',
                                  });
                                }
                                if ((isAdmin || isAccountant) && p.paymentStatus !== 'paid' && p.status !== 'cancelled') {
                                  actions.push({
                                    label: 'Record Payment', icon: CreditCard,
                                    onClick: () => { setPaymentTarget(p); setPaymentAmount(''); setOpenMenuId(null); },
                                    className: 'text-primary-600 hover:bg-primary-50',
                                  });
                                }

                                if (actions.length === 0) {
                                  let note = 'No actions available';
                                  if (p.approvalStatus === 'admin_approved' && p.dueAmount > 0) note = 'Settle balance to mark paid';
                                  if (p.status === 'pending' && p.paymentStatus === 'paid') note = 'Confirm receipt to close out';
                                  return <p className="px-3 py-2 text-[11px] text-clinical-400">{note}</p>;
                                }

                                return actions.map((a, i) => {
                                  const Icon = a.icon;
                                  return (
                                    <button
                                      key={i}
                                      onClick={a.onClick}
                                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium ${a.className}`}
                                    >
                                      <Icon size={13} /> {a.label}
                                    </button>
                                  );
                                });
                              })()}
                            </div>
                          </>,
                          document.body
                        )}
                      </div>
                    </td>'''

    content = content[:start_idx] + new_block + content[end_idx:]

    with open(path, "w") as f:
        f.write(content)
    print("Rewritten actions cell:", path)
