from pathlib import Path

def patch(path: Path, old: str, new: str, label: str):
    src = path.read_text()
    count = src.count(old)
    if count != 1:
        print(f"SKIP — {label} (expected 1 match, found {count})")
        return
    path.write_text(src.replace(old, new))
    print(f"OK — {label}")

root = Path(".")
page = root / "frontend/src/modules/patients/PatientDetailPage.tsx"

patch(
    page,
    "  approvalBlock('Laboratory Results', 'Laboratory Technician');",
    """  const verifiedByName = (labOrders ?? [])
    .filter((o: any) => o.verifiedByName)
    .sort((a: any, b: any) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())[0]?.verifiedByName;
  approvalBlock('Laboratory Results', 'Laboratory Technician', verifiedByName);""",
    "Laboratory Results signature now uses verifiedByName",
)

patch(
    page,
    "  approvalBlock('Prescriptions', 'Pharmacist');",
    """  const dispensedByName = (prescriptions ?? [])
    .filter((p: any) => p.dispensedByName)
    .sort((a: any, b: any) => new Date(b.dispensedAt ?? 0).getTime() - new Date(a.dispensedAt ?? 0).getTime())[0]?.dispensedByName;
  approvalBlock('Prescriptions', 'Pharmacist', dispensedByName);""",
    "Prescriptions signature now uses dispensedByName",
)

patch(
    page,
    "  approvalBlock('Invoices', 'Receptionist / Front Desk');",
    """  const collectedByName = (invoices ?? [])
    .filter((i: any) => i.collectedByName)
    .sort((a: any, b: any) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())[0]?.collectedByName;
  approvalBlock('Invoices', 'Receptionist / Front Desk', collectedByName);""",
    "Invoices signature now uses collectedByName",
)

print("\nDone. Refresh and regenerate a report. Any section without a matching")
print("staff action yet will still show 'Not yet signed', same as before.")
