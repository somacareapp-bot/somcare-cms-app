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
    root / "backend/src/laboratory/entities/lab-order.entity.ts",
    """  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string;
""",
    """  @Column({ name: 'result_text', type: 'text', nullable: true })
  resultText: string;

  // Name of the staff member who entered/verified the results, captured
  // automatically from the authenticated user at the moment of verification.
  @Column({ name: 'verified_by_name', nullable: true })
  verifiedByName: string;
""",
    "lab-order.entity.ts: verifiedByName column added",
)

# 2) Controller — capture req.user on the result endpoint
ctrl = root / "backend/src/laboratory/laboratory.controller.ts"

patch(
    ctrl,
    "import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';",
    "import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';",
    "laboratory.controller.ts: Request import added",
)

patch(
    ctrl,
    """  @Permissions('laboratory:update')
  @Patch(':id/result')
  updateResult(@Param('id') id: string, @Body() dto: UpdateLabResultDto) {
    return this.laboratoryService.updateResult(id, dto);
  }""",
    """  @Permissions('laboratory:update')
  @Patch(':id/result')
  updateResult(@Param('id') id: string, @Body() dto: UpdateLabResultDto, @Request() req: any) {
    return this.laboratoryService.updateResult(id, dto, req.user?.username);
  }""",
    "laboratory.controller.ts: updateResult now forwards req.user.username",
)

# 3) Service — accept and store the name
patch(
    root / "backend/src/laboratory/laboratory.service.ts",
    """  async updateResult(id: string, dto: UpdateLabResultDto): Promise<LabOrder> {
    const order = await this.findOne(id);
    const itemsById = new Map(order.items.map((item) => [item.id, item]));

    for (const entry of dto.items) {
      const item = itemsById.get(entry.itemId);
      if (!item) continue;
      item.resultValue = entry.resultValue;
      item.flag = this.computeFlag(entry.resultValue, item.referenceRange);
      await this.labOrderItemsRepo.save(item);
    }

    order.status = LabOrderStatus.COMPLETED;
    order.completedAt = new Date();
    await this.labOrdersRepo.save(order);
    return this.findOne(id);
  }""",
    """  async updateResult(id: string, dto: UpdateLabResultDto, verifiedByName?: string): Promise<LabOrder> {
    const order = await this.findOne(id);
    const itemsById = new Map(order.items.map((item) => [item.id, item]));

    for (const entry of dto.items) {
      const item = itemsById.get(entry.itemId);
      if (!item) continue;
      item.resultValue = entry.resultValue;
      item.flag = this.computeFlag(entry.resultValue, item.referenceRange);
      await this.labOrderItemsRepo.save(item);
    }

    order.status = LabOrderStatus.COMPLETED;
    order.completedAt = new Date();
    if (verifiedByName) order.verifiedByName = verifiedByName;
    await this.labOrdersRepo.save(order);
    return this.findOne(id);
  }""",
    "laboratory.service.ts: updateResult stores verifiedByName",
)

print("\nDone. Restart the backend — synchronize:true will add the new column in dev.")
