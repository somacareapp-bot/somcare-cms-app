#!/bin/bash
set -e

echo "=============================================="
echo "Building real Profit & Loss backend endpoint"
echo "=============================================="

python3 - << 'PYEOF'
path = "backend/src/reports/reports.module.ts"
with open(path) as f:
    content = f.read()

def replace_once(content, old, new, label):
    n = content.count(old)
    if n != 1:
        print(f"WARNING: expected 1 match for '{label}', found {n}")
        raise SystemExit(1)
    return content.replace(old, new)

old_imports = """import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Invoice } from '../billing/entities/invoice.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Visit, Appointment, Prescription, LabOrder, User, Patient, Medicine, Invoice])],"""
new_imports = """import { Medicine } from '../pharmacy/entities/medicine.entity';
import { Invoice } from '../billing/entities/invoice.entity';
import { Payment } from '../billing/entities/payment.entity';
import { Expense } from '../expenses/entities/expense.entity';
@Module({
  imports: [TypeOrmModule.forFeature([Visit, Appointment, Prescription, LabOrder, User, Patient, Medicine, Invoice, Payment, Expense])],"""

content = replace_once(content, old_imports, new_imports, "reports.module.ts imports/forFeature")

with open(path, "w") as f:
    f.write(content)
print("reports.module.ts updated — Payment + Expense repositories registered.")
PYEOF

python3 - << 'PYEOF'
path = "backend/src/reports/reports.service.ts"
with open(path) as f:
    content = f.read()

def replace_once(content, old, new, label):
    n = content.count(old)
    if n != 1:
        print(f"WARNING: expected 1 match for '{label}', found {n}")
        raise SystemExit(1)
    return content.replace(old, new)

# 1. Add imports for Payment + Expense
old_import = "import { Invoice, InvoiceStatus } from '../billing/entities/invoice.entity';"
new_import = """import { Invoice, InvoiceStatus } from '../billing/entities/invoice.entity';
import { Payment } from '../billing/entities/payment.entity';
import { Expense, ExpenseStatus } from '../expenses/entities/expense.entity';"""
content = replace_once(content, old_import, new_import, "service imports")

# 2. Inject Payment + Expense repos in the constructor
old_ctor = "    @InjectRepository(Invoice)      private readonly invoicesRepo: Repository<Invoice>,\n  ) {}"
new_ctor = """    @InjectRepository(Invoice)      private readonly invoicesRepo: Repository<Invoice>,
    @InjectRepository(Payment)      private readonly paymentsRepo: Repository<Payment>,
    @InjectRepository(Expense)      private readonly expensesRepo: Repository<Expense>,
  ) {}"""
content = replace_once(content, old_ctor, new_ctor, "constructor repo injection")

# 3. Add getProfitLoss() method right before the final closing brace of the class
old_tail = """    return { totalPatients, todayVisits, pendingLabs, pendingPrescriptions };
  }
}"""
new_tail = """    return { totalPatients, todayVisits, pendingLabs, pendingPrescriptions };
  }

  // ── Profit & Loss ────────────────────────────────────────────────────────
  // Income  = actual payments received (invoice_payments table), by their created_at.
  // Expenses = only APPROVED expenses (their own `date` field) — pending/sent-back/
  //            rejected expenses are not confirmed outflows yet.
  async getProfitLoss(from?: string, to?: string) {
    const fromDate = from
      ? new Date(from)
      : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - 29); return d; })();
    fromDate.setHours(0, 0, 0, 0);

    const toDate = to ? new Date(to) : new Date();
    toDate.setHours(23, 59, 59, 999);

    const fromStr = fromDate.toISOString().split('T')[0];
    const toStr = toDate.toISOString().split('T')[0];

    const payments = await this.paymentsRepo
      .createQueryBuilder('p')
      .where('p.created_at >= :fromDate', { fromDate })
      .andWhere('p.created_at <= :toDate', { toDate })
      .getMany();

    const totalIncome = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    const incomeByMethod: Record<string, number> = {};
    for (const p of payments) {
      const method = p.paymentMethod || 'unknown';
      incomeByMethod[method] = Math.round(((incomeByMethod[method] || 0) + Number(p.amount)) * 100) / 100;
    }

    const expenses = await this.expensesRepo
      .createQueryBuilder('e')
      .where('e.status = :status', { status: ExpenseStatus.APPROVED })
      .andWhere('e.date >= :fromStr', { fromStr })
      .andWhere('e.date <= :toStr', { toStr })
      .getMany();

    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    const expensesByCategory: Record<string, number> = {};
    for (const e of expenses) {
      expensesByCategory[e.category] = Math.round(((expensesByCategory[e.category] || 0) + Number(e.amount)) * 100) / 100;
    }

    const dayKey = (d: Date | string) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10);

    const byDay: { date: string; income: number; expenses: number; net: number }[] = [];
    const cursor = new Date(fromDate);
    const endCursor = new Date(toDate);
    endCursor.setHours(0, 0, 0, 0);
    while (cursor <= endCursor) {
      const dStr = dayKey(cursor);
      const dayIncome = payments
        .filter((p) => dayKey(p.createdAt as any) === dStr)
        .reduce((sum, p) => sum + Number(p.amount), 0);
      const dayExpenses = expenses
        .filter((e) => dayKey(e.date as any) === dStr)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      byDay.push({
        date: dStr,
        income: Math.round(dayIncome * 100) / 100,
        expenses: Math.round(dayExpenses * 100) / 100,
        net: Math.round((dayIncome - dayExpenses) * 100) / 100,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return {
      from: fromStr,
      to: toStr,
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      netProfit: Math.round((totalIncome - totalExpenses) * 100) / 100,
      incomeByMethod,
      expensesByCategory,
      byDay,
      paymentCount: payments.length,
      expenseCount: expenses.length,
    };
  }
}"""
content = replace_once(content, old_tail, new_tail, "getProfitLoss method")

with open(path, "w") as f:
    f.write(content)
print("reports.service.ts updated — getProfitLoss() added.")
PYEOF

python3 - << 'PYEOF'
path = "backend/src/reports/reports.controller.ts"
with open(path) as f:
    content = f.read()

def replace_once(content, old, new, label):
    n = content.count(old)
    if n != 1:
        print(f"WARNING: expected 1 match for '{label}', found {n}")
        raise SystemExit(1)
    return content.replace(old, new)

# 1. Add Query to the nestjs/common import
old_import = "import { Controller, Get, UseGuards, Request } from '@nestjs/common';"
new_import = "import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';"
content = replace_once(content, old_import, new_import, "controller imports")

# 2. Add the profit-loss endpoint after admin-dashboard
old_tail = """  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('admin-dashboard')
  getAdminDashboard() {
    return this.reportsService.getAdminDashboard();
  }
}"""
new_tail = """  @UseGuards(PermissionsGuard)
  @Permissions('reports:read')
  @Get('admin-dashboard')
  getAdminDashboard() {
    return this.reportsService.getAdminDashboard();
  }

  @UseGuards(PermissionsGuard)
  @Permissions('billing:read')
  @Get('profit-loss')
  getProfitLoss(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.getProfitLoss(from, to);
  }
}"""
content = replace_once(content, old_tail, new_tail, "profit-loss endpoint")

with open(path, "w") as f:
    f.write(content)
print("reports.controller.ts updated — GET /api/reports/profit-loss added.")
PYEOF

echo ""
echo "=============================================="
echo "Backend done. Restart the backend and verify with:"
echo "  curl -H \"Authorization: Bearer <token>\" http://localhost:3000/api/reports/profit-loss"
echo "=============================================="
