import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, ILike, In, IsNull, Repository } from 'typeorm';
import { LabOrder, LabOrderStatus } from './entities/lab-order.entity';
import { LabOrderItem, LabResultFlag } from './entities/lab-order-item.entity';
import { LabOrderCharge } from './entities/lab-order-charge.entity';
import { LabTestCatalog, LabTestCostMode } from '../settings/laboratory/entities/lab-test-catalog.entity';
import { LabTestSupplyItem } from '../settings/laboratory/entities/lab-test-supply-item.entity';
import { LabSupply } from '../inventory/entities/lab-supply.entity';
import {
  LabSupplyStockLog,
  LabSupplyStockLogType,
  LabSupplyStockLogReferenceType,
} from '../inventory/entities/lab-supply-stock-log.entity';
import { CreateLabOrderDto } from './dto/create-lab-order.dto';
import { UpdateLabOrderStatusDto } from './dto/update-lab-order-status.dto';
import { UpdateLabResultDto } from './dto/update-lab-result.dto';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// A test as it is actually billed and costed: the panel, not its analytes.
interface BillableUnit {
  test: LabTestCatalog;
  quantity: number;
}

@Injectable()
export class LaboratoryService {
  constructor(
    @InjectRepository(LabOrder)
    private readonly labOrdersRepo: Repository<LabOrder>,
    @InjectRepository(LabOrderItem)
    private readonly labOrderItemsRepo: Repository<LabOrderItem>,
    @InjectRepository(LabTestCatalog)
    private readonly labTestCatalogRepo: Repository<LabTestCatalog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async generateLabOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.labOrdersRepo.count({
      where: { labOrderNumber: ILike(`LAB-${year}-%`) },
    });
    const next = (count + 1).toString().padStart(6, '0');
    return `LAB-${year}-${next}`;
  }

  async create(dto: CreateLabOrderDto): Promise<LabOrder> {
    const selected = await this.labTestCatalogRepo.find({ where: { id: In(dto.testIds) } });
    if (selected.length === 0) {
      throw new BadRequestException('No valid tests selected');
    }

    // Expand any selected panels (e.g. CBC) into their component tests.
    const panelIds = selected.filter((t) => t.isPanel).map((t) => t.id);
    const components = panelIds.length
      ? await this.labTestCatalogRepo.find({ where: { panelId: In(panelIds) } })
      : [];

    const flatTests = [...selected.filter((t) => !t.isPanel), ...components];
    const uniqueTests = Array.from(new Map(flatTests.map((t) => [t.id, t])).values());

    const labOrderNumber = await this.generateLabOrderNumber();
    const order = this.labOrdersRepo.create({
      labOrderNumber,
      visitId: dto.visitId,
      patientId: dto.patientId,
      notes: dto.notes,
      testName: selected.map((t) => t.name).join(', '),
      status: LabOrderStatus.ORDERED,
      orderedAt: new Date(),
    });
    const saved = await this.labOrdersRepo.save(order);

    const items = uniqueTests.map((t) =>
      this.labOrderItemsRepo.create({
        labOrderId: saved.id,
        testCatalogId: t.id,
        testName: t.name,
        category: t.category,
        unit: t.unit,
        referenceRange: t.referenceRange,
      }),
    );
    await this.labOrderItemsRepo.save(items);

    // Ordering reserves nothing and consumes nothing: stock moves at sample
    // collection (see updateStatus), with a fallback at completion.
    return this.findOne(saved.id);
  }

  // Work queue board: group active orders by status
  async findQueue() {
    const orders = await this.labOrdersRepo.find({
      where: [
        { status: LabOrderStatus.ORDERED },
        { status: LabOrderStatus.SAMPLE_COLLECTED },
        { status: LabOrderStatus.IN_PROGRESS },
      ],
      relations: ['patient', 'visit', 'items'],
      order: { orderedAt: 'ASC' },
    });

    const columns: Record<LabOrderStatus, LabOrder[]> = {
      [LabOrderStatus.ORDERED]: [],
      [LabOrderStatus.SAMPLE_COLLECTED]: [],
      [LabOrderStatus.IN_PROGRESS]: [],
      [LabOrderStatus.COMPLETED]: [],
      [LabOrderStatus.CANCELLED]: [],
    };
    orders.forEach((o) => columns[o.status].push(o));
    return columns;
  }

  // patientId: optional filter so PatientDetailPage's Lab Results tab
  // can pull only this patient's orders instead of the whole table.
  async findAll(status?: LabOrderStatus, patientId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    return this.labOrdersRepo.find({
      where,
      relations: ['patient', 'visit', 'items'],
      order: { orderedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<LabOrder> {
    const order = await this.labOrdersRepo.findOne({
      where: { id },
      relations: ['patient', 'visit', 'items', 'charges'],
    });
    if (!order) throw new NotFoundException('Lab order not found');
    return order;
  }

  async findByVisit(visitId: string): Promise<LabOrder[]> {
    return this.labOrdersRepo.find({
      where: { visitId },
      relations: ['items'],
      order: { orderedAt: 'DESC' },
    });
  }

  /**
   * Status transitions.
   *
   * Stock is dispensed here, on the first transition into SAMPLE_COLLECTED —
   * not at result entry. A collected sample burns reagents/tubes whether or
   * not results ever get typed in, so charging inventory at collection time
   * matches what actually happened at the bench. If stock is short, throwing
   * inside this transaction rolls back the status change too: the order
   * stays ORDERED and never shows as collected.
   *
   * Cancelling an order that already consumed stock reverses that
   * consumption (see reverseConsumption) so cancelled orders don't leak
   * inventory.
   */
  async updateStatus(id: string, dto: UpdateLabOrderStatusDto): Promise<LabOrder> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(LabOrder);
      const order = await orderRepo.findOne({ where: { id }, relations: ['items'] });
      if (!order) throw new NotFoundException('Lab order not found');

      const isFirstCollection =
        dto.status === LabOrderStatus.SAMPLE_COLLECTED && !order.sampleCollectedAt;

      if (isFirstCollection) {
        order.sampleCollectedAt = new Date();
        if (!order.costedAt) {
          await this.consumeAndCost(manager, order, dto.userId);
        }
      }

      if (
        dto.status === LabOrderStatus.CANCELLED &&
        order.status !== LabOrderStatus.CANCELLED &&
        order.costedAt
      ) {
        await this.reverseConsumption(manager, order);
      }

      order.status = dto.status;
      await orderRepo.save(order);
    });

    return this.findOne(id);
  }

  /**
   * Dry run of the deduction that sample collection would perform. Lets the
   * technician see a shortfall before collecting, rather than after.
   */
  async previewConsumption(id: string) {
    const order = await this.findOne(id);
    const units = await this.resolveBillableUnits(this.dataSource.manager, order);
    const recipes = await this.loadRecipes(this.dataSource.manager, units);
    const required = this.aggregateRequirements(units, recipes);

    if (!required.size) {
      return { alreadyCosted: !!order.costedAt, requirements: [], shortfalls: [], sufficient: true };
    }

    const supplies = await this.dataSource.manager.getRepository(LabSupply).find({
      where: { id: In([...required.keys()]) },
    });
    const byId = new Map(supplies.map((s) => [s.id, s]));

    const requirements = [...required.entries()].map(([supplyId, quantity]) => {
      const supply = byId.get(supplyId);
      const available = supply?.stockQuantity ?? 0;
      return {
        labSupplyId: supplyId,
        name: supply?.name ?? 'Unknown item',
        required: quantity,
        available,
        sufficient: available >= quantity,
      };
    });

    return {
      alreadyCosted: !!order.costedAt,
      requirements,
      shortfalls: requirements.filter((r) => !r.sufficient),
      sufficient: requirements.every((r) => r.sufficient),
    };
  }

  // Best-effort flagging against a reference range like "90-130", "< 150", or "> 4.0".
  // Returns null (unflagged) for anything it can't confidently parse.
  private computeFlag(resultValue: string, referenceRange?: string): LabResultFlag | null {
    if (!referenceRange) return null;
    const numeric = parseFloat(resultValue);
    if (Number.isNaN(numeric)) return null;

    const rangeMatch = referenceRange.match(/^([\d.]+)\s*-\s*([\d.]+)/);
    if (rangeMatch) {
      const low = parseFloat(rangeMatch[1]);
      const high = parseFloat(rangeMatch[2]);
      if (numeric < low) return LabResultFlag.LOW;
      if (numeric > high) return LabResultFlag.HIGH;
      return LabResultFlag.NORMAL;
    }

    const ltMatch = referenceRange.match(/^<\s*([\d.]+)/);
    if (ltMatch) {
      const max = parseFloat(ltMatch[1]);
      return numeric > max ? LabResultFlag.HIGH : LabResultFlag.NORMAL;
    }

    const gtMatch = referenceRange.match(/^>\s*([\d.]+)/);
    if (gtMatch) {
      const min = parseFloat(gtMatch[1]);
      return numeric < min ? LabResultFlag.LOW : LabResultFlag.NORMAL;
    }

    return null;
  }

  /**
   * Save results and mark the order completed.
   *
   * Stock was normally already dispensed at SAMPLE_COLLECTED (see
   * updateStatus), so the common case here is just writing results and
   * flipping status — costedAt is already set and consumeAndCost is skipped.
   * The fallback only fires for an order that reached COMPLETED without ever
   * passing through SAMPLE_COLLECTED, so results/completion never blocks on
   * a stock shortfall that should have been caught earlier.
   *
   * Everything below runs in one database transaction: results, the
   * (fallback) availability check, the deduction, the stock ledger entries
   * and the revenue/cost/profit snapshot either all land or none do.
   */
  async updateResult(
    id: string,
    dto: UpdateLabResultDto,
    verifiedByName?: string,
    userId?: string,
  ): Promise<LabOrder> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(LabOrder);
      const itemRepo = manager.getRepository(LabOrderItem);

      const order = await orderRepo.findOne({ where: { id }, relations: ['items'] });
      if (!order) throw new NotFoundException('Lab order not found');
      if (order.status === LabOrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot enter results on a cancelled lab order');
      }

      const itemsById = new Map(order.items.map((item) => [item.id, item]));
      for (const entry of dto.items) {
        const item = itemsById.get(entry.itemId);
        if (!item) continue;
        item.resultValue = entry.resultValue;
        item.flag = this.computeFlag(entry.resultValue, item.referenceRange);
        await itemRepo.save(item);
      }

      // Re-saving results on an already-costed order (the normal case, since
      // consumption happened at collection) must not deduct stock twice.
      if (!order.costedAt) {
        await this.consumeAndCost(manager, order, userId);
      }

      order.status = LabOrderStatus.COMPLETED;
      order.completedAt = new Date();
      if (verifiedByName) order.verifiedByName = verifiedByName;
      await orderRepo.save(order);
    });

    return this.findOne(id);
  }

  /**
   * Collapse order items back to the tests that are actually billed.
   *
   * create() expands a panel into its analytes, so a CBC order has ~8 LabOrderItem
   * rows and no row for CBC itself. Costing those rows individually would both bill
   * the wrong amount and miss the recipe, which lives on the panel. So: any item
   * whose catalog row has a panelId is attributed to that panel, counted once.
   */
  private async resolveBillableUnits(manager: EntityManager, order: LabOrder): Promise<BillableUnit[]> {
    const catalogRepo = manager.getRepository(LabTestCatalog);
    const items = order.items ?? [];
    const catalogIds = [...new Set(items.map((i) => i.testCatalogId).filter(Boolean))] as string[];
    if (!catalogIds.length) return [];

    const rows = await catalogRepo.find({ where: { id: In(catalogIds) } });
    const byId = new Map(rows.map((r) => [r.id, r]));

    const counts = new Map<string, number>();
    for (const item of items) {
      if (!item.testCatalogId) continue;
      const row = byId.get(item.testCatalogId);
      if (!row) continue;
      const billableId = row.panelId ?? row.id;
      // A panel is one charge no matter how many analytes it expanded into; a
      // standalone test ordered twice on one order is two.
      counts.set(billableId, row.panelId ? 1 : (counts.get(billableId) ?? 0) + 1);
    }
    if (!counts.size) return [];

    const billableRows = await catalogRepo.find({ where: { id: In([...counts.keys()]) } });
    return billableRows.map((test) => ({ test, quantity: counts.get(test.id) ?? 1 }));
  }

  private async loadRecipes(
    manager: EntityManager,
    units: BillableUnit[],
  ): Promise<Map<string, LabTestSupplyItem[]>> {
    const byTest = new Map<string, LabTestSupplyItem[]>();
    if (!units.length) return byTest;

    const components = await manager.getRepository(LabTestSupplyItem).find({
      where: { testCatalogId: In(units.map((u) => u.test.id)) },
      relations: ['labSupply'],
    });
    for (const c of components) {
      const list = byTest.get(c.testCatalogId) ?? [];
      list.push(c);
      byTest.set(c.testCatalogId, list);
    }
    return byTest;
  }

  /**
   * Total units of each supply the whole order needs. Aggregated across tests before
   * any check, so two tests sharing one reagent are validated against the combined
   * requirement rather than each passing on its own and overdrawing together.
   * Deduction uses whole units; wastage affects cost only.
   */
  private aggregateRequirements(
    units: BillableUnit[],
    recipes: Map<string, LabTestSupplyItem[]>,
  ): Map<string, number> {
    const required = new Map<string, number>();
    for (const unit of units) {
      for (const component of recipes.get(unit.test.id) ?? []) {
        const qty = Number(component.quantityPerTest) * unit.quantity;
        required.set(component.labSupplyId, (required.get(component.labSupplyId) ?? 0) + qty);
      }
    }
    return required;
  }

  private async consumeAndCost(manager: EntityManager, order: LabOrder, userId?: string) {
    const units = await this.resolveBillableUnits(manager, order);
    const recipes = await this.loadRecipes(manager, units);
    const required = this.aggregateRequirements(units, recipes);

    const supplyRepo = manager.getRepository(LabSupply);
    const logRepo = manager.getRepository(LabSupplyStockLog);
    const chargeRepo = manager.getRepository(LabOrderCharge);

    let supplies = new Map<string, LabSupply>();

    if (required.size) {
      // Row locks held until commit, so two technicians completing tests that share a
      // reagent cannot both read the same "available" figure and both pass the check.
      const locked = await supplyRepo.find({
        where: { id: In([...required.keys()]) },
        lock: { mode: 'pessimistic_write' },
      });
      supplies = new Map(locked.map((s) => [s.id, s]));

      const shortfalls: string[] = [];
      for (const [supplyId, quantity] of required) {
        const supply = supplies.get(supplyId);
        if (!supply) {
          shortfalls.push(`A supply in the test recipe no longer exists (${supplyId})`);
          continue;
        }
        if (supply.stockQuantity < quantity) {
          shortfalls.push(
            `${supply.name} — required: ${quantity}, available: ${supply.stockQuantity}`,
          );
        }
      }
      if (shortfalls.length) {
        // Throwing rolls the transaction back: no stock moved, order stays open.
        throw new BadRequestException(`Insufficient laboratory stock. ${shortfalls.join('; ')}`);
      }
    }

    // Cost each billable test from its own recipe before stock is touched, so the
    // recorded cost reflects the unit costs that were in force at completion.
    const charges: LabOrderCharge[] = [];
    let totalRevenue = 0;
    let totalCost = 0;

    for (const unit of units) {
      const components = recipes.get(unit.test.id) ?? [];
      const autoUnitCost = roundMoney(
        components.reduce((sum, c) => {
          const wastage = Number(c.wastagePercent ?? 0);
          const effectiveQty = Number(c.quantityPerTest) * (1 + wastage / 100);
          return sum + effectiveQty * Number(c.labSupply?.costPrice ?? 0);
        }, 0),
      );

      const manual =
        unit.test.manualCostOverride === null || unit.test.manualCostOverride === undefined
          ? null
          : Number(unit.test.manualCostOverride);
      const isManual = unit.test.costCalculationMode === LabTestCostMode.MANUAL && manual !== null;
      const unitCost = isManual ? manual : autoUnitCost;
      const unitPrice = Number(unit.test.price ?? 0);

      const revenue = roundMoney(unitPrice * unit.quantity);
      const cost = roundMoney(unitCost * unit.quantity);

      totalRevenue = roundMoney(totalRevenue + revenue);
      totalCost = roundMoney(totalCost + cost);

      charges.push(
        chargeRepo.create({
          labOrderId: order.id,
          testCatalogId: unit.test.id,
          testName: unit.test.name,
          category: unit.test.category,
          quantity: unit.quantity,
          unitPrice,
          unitCost,
          revenue,
          cost,
          grossProfit: roundMoney(revenue - cost),
          costMode: isManual ? LabTestCostMode.MANUAL : LabTestCostMode.AUTO,
          hasRecipe: components.length > 0,
        }),
      );
    }

    // Deduct and write the ledger. Unit costs on the log rows are snapshots: a later
    // purchase that changes costPrice must not rewrite history.
    for (const [supplyId, quantity] of required) {
      const supply = supplies.get(supplyId)!;
      const previousStock = supply.stockQuantity;
      supply.stockQuantity = previousStock - quantity;
      await supplyRepo.save(supply);

      const unitCost = Number(supply.costPrice ?? 0);
      await logRepo.save(
        logRepo.create({
          labSupplyId: supplyId,
          type: LabSupplyStockLogType.ISSUE,
          quantity,
          previousStock,
          newStock: supply.stockQuantity,
          reason: `Laboratory usage — ${order.labOrderNumber}`,
          referenceType: LabSupplyStockLogReferenceType.LAB_ORDER,
          referenceId: order.id,
          referenceNumber: order.labOrderNumber,
          unitCost,
          totalCost: roundMoney(unitCost * quantity),
          createdBy: userId,
        }),
      );
    }

    if (charges.length) await chargeRepo.save(charges);

    order.totalRevenue = totalRevenue;
    order.totalCost = totalCost;
    order.grossProfit = roundMoney(totalRevenue - totalCost);
    order.costedAt = new Date();
  }

  /**
   * Undo a completed consumeAndCost() when an order is cancelled after stock was
   * already dispensed (normally at sample collection). Restocks every supply it
   * took, voids its LabOrderCharge rows (kept, not deleted — audit trail), and
   * zeroes the order's revenue/cost/profit snapshot back to null. All in the same
   * transaction as the status change that triggered it, so an order can never end
   * up half-reversed: stock restored but charges still live, or vice versa.
   *
   * Idempotent: if a reversal has already run for this order (a RESTOCK log
   * referencing it already exists), this is a no-op — including the void step, so
   * calling this twice never double-fires either half.
   */
  private async reverseConsumption(manager: EntityManager, order: LabOrder) {
    const logRepo = manager.getRepository(LabSupplyStockLog);
    const supplyRepo = manager.getRepository(LabSupply);
    const chargeRepo = manager.getRepository(LabOrderCharge);
    const orderRepo = manager.getRepository(LabOrder);

    const existingReversal = await logRepo.findOne({
      where: {
        referenceType: LabSupplyStockLogReferenceType.LAB_ORDER,
        referenceId: order.id,
        type: LabSupplyStockLogType.RESTOCK,
      },
    });
    if (existingReversal) return;

    const issueLogs = await logRepo.find({
      where: {
        referenceType: LabSupplyStockLogReferenceType.LAB_ORDER,
        referenceId: order.id,
        type: LabSupplyStockLogType.ISSUE,
      },
    });

    if (issueLogs.length) {
      const supplyIds = [...new Set(issueLogs.map((l) => l.labSupplyId))];
      const locked = await supplyRepo.find({
        where: { id: In(supplyIds) },
        lock: { mode: 'pessimistic_write' },
      });
      const byId = new Map(locked.map((s) => [s.id, s]));

      for (const log of issueLogs) {
        const supply = byId.get(log.labSupplyId);
        if (!supply) continue; // supply row deleted since — nothing to restock onto
        const previousStock = supply.stockQuantity;
        supply.stockQuantity = previousStock + log.quantity;
        await supplyRepo.save(supply);

        await logRepo.save(
          logRepo.create({
            labSupplyId: log.labSupplyId,
            type: LabSupplyStockLogType.RESTOCK,
            quantity: log.quantity,
            previousStock,
            newStock: supply.stockQuantity,
            reason: `Lab order cancelled — reversal of ${order.labOrderNumber}`,
            referenceType: LabSupplyStockLogReferenceType.LAB_ORDER,
            referenceId: order.id,
            referenceNumber: order.labOrderNumber,
          }),
        );
      }
    }

    // Void the charges: kept for audit, but a cancelled order must never read
    // as revenue. Only touches rows not already voided, so re-running this is safe.
    const charges = await chargeRepo.find({
      where: { labOrderId: order.id, voidedAt: IsNull() },
    });
    if (charges.length) {
      const now = new Date();
      for (const charge of charges) charge.voidedAt = now;
      await chargeRepo.save(charges);
    }

    // Null, not 0 — 0 would read as "costed at zero", null reads as "not costed",
    // which is what a cancelled-and-reversed order actually is.
    order.totalRevenue = null;
    order.totalCost = null;
    order.grossProfit = null;
    await orderRepo.save(order);
  }
}
