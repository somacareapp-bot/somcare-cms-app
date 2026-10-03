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

# 1) Entity — new column
patch(
    root / "backend/src/visits/entities/prescription.entity.ts",
    """  @Column({ name: 'dispensed_at', type: 'timestamptz', nullable: true })
  dispensedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;""",
    """  @Column({ name: 'dispensed_at', type: 'timestamptz', nullable: true })
  dispensedAt: Date;

  // Name of the staff member who dispensed this prescription, captured
  // automatically from the authenticated user — not a free-text field.
  @Column({ name: 'dispensed_by_name', nullable: true })
  dispensedByName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;""",
    "prescription.entity.ts: dispensedByName column added",
)

# 2) Controller — capture req.user on the dispense endpoint
ctrl = root / "backend/src/pharmacy/pharmacy.controller.ts"

patch(
    ctrl,
    "import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';",
    "import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';",
    "pharmacy.controller.ts: Request import added",
)

patch(
    ctrl,
    """  @Post('prescriptions/:id/dispense')
  dispense(@Param('id') id: string, @Body() dto: DispensePrescriptionDto) {
    return this.pharmacyService.dispense(id, dto);
  }""",
    """  @Post('prescriptions/:id/dispense')
  dispense(@Param('id') id: string, @Body() dto: DispensePrescriptionDto, @Request() req: any) {
    return this.pharmacyService.dispense(id, dto, req.user?.username);
  }""",
    "pharmacy.controller.ts: dispense now forwards req.user.username",
)

# 3) Service — accept and store the name
svc = root / "backend/src/pharmacy/pharmacy.service.ts"

patch(
    svc,
    "  async dispense(id: string, dto: DispensePrescriptionDto): Promise<Prescription> {",
    "  async dispense(id: string, dto: DispensePrescriptionDto, dispensedByName?: string): Promise<Prescription> {",
    "pharmacy.service.ts: dispense() signature updated",
)

patch(
    svc,
    """    prescription.status = PrescriptionStatus.DISPENSED;
    prescription.dispensedAt = new Date();
    return this.prescriptionsRepo.save(prescription);
  }""",
    """    prescription.status = PrescriptionStatus.DISPENSED;
    prescription.dispensedAt = new Date();
    if (dispensedByName) prescription.dispensedByName = dispensedByName;
    return this.prescriptionsRepo.save(prescription);
  }""",
    "pharmacy.service.ts: dispense() stores dispensedByName",
)

print("\nDone. Restart the backend — synchronize:true will add the new column in dev.")
