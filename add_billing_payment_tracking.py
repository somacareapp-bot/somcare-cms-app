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
    root / "backend/src/billing/entities/invoice.entity.ts",
    """  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.UNPAID })
  status: InvoiceStatus;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true, eager: true })
  items: InvoiceItem[];""",
    """  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.UNPAID })
  status: InvoiceStatus;

  // Name of the staff member who recorded the most recent payment, captured
  // automatically from the authenticated user — not a free-text field.
  @Column({ name: 'collected_by_name', nullable: true })
  collectedByName: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true, eager: true })
  items: InvoiceItem[];""",
    "invoice.entity.ts: collectedByName column added",
)

# 2) Controller — this one already uses @Req() req: AuthenticatedRequest elsewhere
# (see the existing `create()` method), so no new import is needed.
patch(
    root / "backend/src/billing/billing.controller.ts",
    """  @Permissions('billing:update')
  @Post('invoices/:id/payments')
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto) {
    return this.billingService.recordPayment(id, dto);
  }""",
    """  @Permissions('billing:update')
  @Post('invoices/:id/payments')
  recordPayment(@Param('id') id: string, @Body() dto: RecordPaymentDto, @Req() req: AuthenticatedRequest) {
    return this.billingService.recordPayment(id, dto, req.user?.username);
  }""",
    "billing.controller.ts: recordPayment now forwards req.user.username",
)

# 3) Service — accept and store the name
patch(
    root / "backend/src/billing/billing.service.ts",
    """  async recordPayment(id: string, dto: RecordPaymentDto) {
    const invoice = await this.getOne(id);
    const newPaid = Number(invoice.paid) + dto.amount;
    if (newPaid > Number(invoice.total)) {
      throw new BadRequestException('Payment exceeds invoice total');
    }
    invoice.paid = newPaid;
    invoice.status =
      newPaid >= Number(invoice.total)
        ? InvoiceStatus.PAID
        : newPaid > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.UNPAID;
    await this.invoicesRepo.save(invoice);""",
    """  async recordPayment(id: string, dto: RecordPaymentDto, collectedByName?: string) {
    const invoice = await this.getOne(id);
    const newPaid = Number(invoice.paid) + dto.amount;
    if (newPaid > Number(invoice.total)) {
      throw new BadRequestException('Payment exceeds invoice total');
    }
    invoice.paid = newPaid;
    invoice.status =
      newPaid >= Number(invoice.total)
        ? InvoiceStatus.PAID
        : newPaid > 0
        ? InvoiceStatus.PARTIAL
        : InvoiceStatus.UNPAID;
    if (collectedByName) invoice.collectedByName = collectedByName;
    await this.invoicesRepo.save(invoice);""",
    "billing.service.ts: recordPayment stores collectedByName",
)

print("\nDone. Restart the backend — synchronize:true will add the new column in dev.")
print("Note: if billing.controller.ts's recordPayment patch was SKIPped because the")
print("Req/AuthenticatedRequest names differ slightly in your file, tell me the exact")
print("import line at the top of billing.controller.ts and I'll adjust.")
