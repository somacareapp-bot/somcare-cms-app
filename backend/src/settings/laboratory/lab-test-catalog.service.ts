import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LabTestCatalog, LabTestCostMode } from './entities/lab-test-catalog.entity';
import { LabTestSupplyItem } from './entities/lab-test-supply-item.entity';
import { LabSupply } from '../../inventory/entities/lab-supply.entity';
import { CreateLabTestDto } from './dto/create-lab-test.dto';
import { UpdateLabTestDto } from './dto/update-lab-test.dto';
import { SetTestComponentsDto } from './dto/set-test-components.dto';
import { SetTestCostModeDto } from './dto/set-test-cost-mode.dto';
import { LAB_TEST_SEED } from './seed-data';

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Cost of one component for one run of a test.
 * Component Cost = quantityPerTest x (1 + wastage%) x supply unit cost.
 */
export function componentCost(component: LabTestSupplyItem): number {
  const unitCost = Number(component.labSupply?.costPrice ?? 0);
  const wastage = Number(component.wastagePercent ?? 0);
  const effectiveQty = Number(component.quantityPerTest) * (1 + wastage / 100);
  return roundMoney(effectiveQty * unitCost);
}

@Injectable()
export class LabTestCatalogService {
  constructor(
    @InjectRepository(LabTestCatalog)
    private readonly repo: Repository<LabTestCatalog>,
    @InjectRepository(LabTestSupplyItem)
    private readonly componentsRepo: Repository<LabTestSupplyItem>,
    @InjectRepository(LabSupply)
    private readonly suppliesRepo: Repository<LabSupply>,
  ) {}

  findAll(search?: string) {
    if (search) {
      return this.repo
        .createQueryBuilder('t')
        .where('LOWER(t.name) LIKE LOWER(:s)', { s: `%${search}%` })
        .orderBy('t.name', 'ASC')
        .getMany();
    }
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    const test = await this.repo.findOne({ where: { id } });
    if (!test) throw new NotFoundException('Lab test not found');
    return test;
  }

  async create(dto: CreateLabTestDto) {
    const existing = await this.repo.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('A test with this name already exists');
    const test = this.repo.create(dto);
    return this.repo.save(test);
  }

  async update(id: string, dto: UpdateLabTestDto) {
    const test = await this.findOne(id);
    Object.assign(test, dto);
    return this.repo.save(test);
  }

  async remove(id: string) {
    const test = await this.findOne(id);
    await this.repo.remove(test);
    return { success: true };
  }

  async seedIfEmpty() {
    const count = await this.repo.count();
    if (count > 0) return { seeded: false, count };
    const rows = LAB_TEST_SEED.map((t) => this.repo.create(t));
    await this.repo.save(rows);
    return { seeded: true, count: rows.length };
  }

  // ----- Test Recipe / BOM -----

  async getComponents(testId: string) {
    await this.findOne(testId);
    const components = await this.componentsRepo.find({
      where: { testCatalogId: testId },
      relations: ['labSupply'],
    });
    return components
      .map((c) => this.presentComponent(c))
      .sort((a, b) => a.labSupplyName.localeCompare(b.labSupplyName));
  }

  /**
   * Full replacement of the recipe. Done as delete-then-insert rather than a diff so
   * the stored recipe always matches exactly what the admin saw on screen; a partial
   * patch would silently keep components they had removed from the form.
   */
  async setComponents(testId: string, dto: SetTestComponentsDto) {
    const test = await this.findOne(testId);

    const supplyIds = dto.components.map((c) => c.labSupplyId);
    const duplicates = supplyIds.filter((id, i) => supplyIds.indexOf(id) !== i);
    if (duplicates.length) {
      throw new BadRequestException('Each inventory item may appear only once in a test recipe');
    }

    if (supplyIds.length) {
      const supplies = await this.suppliesRepo.find({ where: { id: In(supplyIds) } });
      if (supplies.length !== supplyIds.length) {
        const found = new Set(supplies.map((s) => s.id));
        const missing = supplyIds.filter((id) => !found.has(id));
        throw new BadRequestException(`Unknown lab supply: ${missing.join(', ')}`);
      }
      const inactive = supplies.filter((s) => !s.isActive);
      if (inactive.length) {
        throw new BadRequestException(
          `Cannot add discontinued supplies to a recipe: ${inactive.map((s) => s.name).join(', ')}`,
        );
      }
    }

    await this.componentsRepo.delete({ testCatalogId: test.id });
    if (dto.components.length) {
      await this.componentsRepo.save(
        dto.components.map((c) =>
          this.componentsRepo.create({
            testCatalogId: test.id,
            labSupplyId: c.labSupplyId,
            quantityPerTest: c.quantityPerTest,
            wastagePercent: c.wastagePercent ?? 0,
            notes: c.notes ?? null,
          }),
        ),
      );
    }

    return this.getCostBreakdown(test.id);
  }

  // ----- Costing -----

  async setCostMode(testId: string, dto: SetTestCostModeDto) {
    const test = await this.findOne(testId);

    if (dto.costCalculationMode === LabTestCostMode.MANUAL) {
      if (dto.manualCostOverride === undefined || dto.manualCostOverride === null) {
        throw new BadRequestException('A manual cost is required when switching to manual costing');
      }
      if (!dto.manualCostReason || !dto.manualCostReason.trim()) {
        throw new BadRequestException('A reason is required when overriding the calculated cost');
      }
      test.manualCostOverride = dto.manualCostOverride;
      test.manualCostReason = dto.manualCostReason.trim();
    } else {
      // Returning to automatic clears the override so a later switch back to manual
      // cannot silently resurrect a stale figure.
      test.manualCostOverride = null;
      test.manualCostReason = null;
    }

    test.costCalculationMode = dto.costCalculationMode;
    await this.repo.save(test);
    return this.getCostBreakdown(test.id);
  }

  async getCostBreakdown(testId: string) {
    const test = await this.findOne(testId);
    const components = await this.componentsRepo.find({
      where: { testCatalogId: testId },
      relations: ['labSupply'],
    });
    return this.buildCosting(test, components);
  }

  /**
   * Feeds the "Laboratory -> Services" screen.
   * Panel component rows (WBC inside CBC) are hidden by default: they are analytes,
   * not separately sold services, and listing them makes every margin look wrong.
   */
  async findCostingSummary(search?: string, includeComponents = false) {
    const qb = this.repo.createQueryBuilder('t').orderBy('t.name', 'ASC');
    if (search) qb.andWhere('LOWER(t.name) LIKE LOWER(:s)', { s: `%${search}%` });
    if (!includeComponents) qb.andWhere('t.panel_id IS NULL');
    const tests = await qb.getMany();
    if (!tests.length) return [];

    const components = await this.componentsRepo.find({
      where: { testCatalogId: In(tests.map((t) => t.id)) },
      relations: ['labSupply'],
    });
    const byTest = new Map<string, LabTestSupplyItem[]>();
    for (const c of components) {
      const list = byTest.get(c.testCatalogId) ?? [];
      list.push(c);
      byTest.set(c.testCatalogId, list);
    }

    return tests.map((t) => {
      const costing = this.buildCosting(t, byTest.get(t.id) ?? []);
      const { components: _omit, ...summary } = costing;
      return summary;
    });
  }

  private presentComponent(c: LabTestSupplyItem) {
    const unitCost = Number(c.labSupply?.costPrice ?? 0);
    const wastage = Number(c.wastagePercent ?? 0);
    return {
      id: c.id,
      labSupplyId: c.labSupplyId,
      labSupplyName: c.labSupply?.name ?? 'Unknown item',
      labSupplyUnit: (c.labSupply as any)?.unit ?? null,
      stockQuantity: c.labSupply?.stockQuantity ?? 0,
      quantityPerTest: Number(c.quantityPerTest),
      wastagePercent: wastage,
      effectiveQuantity: roundMoney(Number(c.quantityPerTest) * (1 + wastage / 100)),
      unitCost,
      calculatedCost: componentCost(c),
      notes: c.notes,
    };
  }

  private buildCosting(test: LabTestCatalog, components: LabTestSupplyItem[]) {
    const presented = components
      .map((c) => this.presentComponent(c))
      .sort((a, b) => a.labSupplyName.localeCompare(b.labSupplyName));

    const autoCost = roundMoney(presented.reduce((sum, c) => sum + c.calculatedCost, 0));
    const sellingPrice = Number(test.price ?? 0);
    const manual = test.manualCostOverride === null || test.manualCostOverride === undefined
      ? null
      : Number(test.manualCostOverride);
    const isManual = test.costCalculationMode === LabTestCostMode.MANUAL && manual !== null;
    const effectiveCost = isManual ? manual : autoCost;
    const grossProfit = roundMoney(sellingPrice - effectiveCost);

    return {
      id: test.id,
      name: test.name,
      category: test.category,
      department: 'Laboratory',
      active: test.active,
      isPanel: test.isPanel,
      panelId: test.panelId,
      sellingPrice,
      costCalculationMode: test.costCalculationMode,
      autoCost,
      manualCostOverride: manual,
      manualCostReason: test.manualCostReason,
      // Positive = the override adds cost the recipe does not capture (wastage, labour).
      manualAdjustment: isManual ? roundMoney(manual - autoCost) : null,
      effectiveCost,
      grossProfit,
      grossMargin: sellingPrice > 0 ? roundMoney((grossProfit / sellingPrice) * 100) : 0,
      componentCount: presented.length,
      // Distinguishes "costs nothing" from "nobody has configured this yet".
      hasRecipe: presented.length > 0,
      components: presented,
    };
  }
}
