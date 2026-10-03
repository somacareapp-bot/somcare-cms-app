import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, ILike, In, Repository } from 'typeorm';
import { RadiologyOrder, RadiologyOrderStatus } from './entities/radiology-order.entity';
import { RadiologyOrderItem } from './entities/radiology-order-item.entity';
import { RadiologyTestCatalog } from '../settings/radiology/entities/radiology-test-catalog.entity';
import { CreateRadiologyOrderDto } from './dto/create-radiology-order.dto';
import { UpdateRadiologyOrderStatusDto } from './dto/update-radiology-order-status.dto';
import { UpdateRadiologyResultDto } from './dto/update-radiology-result.dto';

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

@Injectable()
export class RadiologyService {
  constructor(
    @InjectRepository(RadiologyOrder)
    private readonly ordersRepo: Repository<RadiologyOrder>,
    @InjectRepository(RadiologyOrderItem)
    private readonly itemsRepo: Repository<RadiologyOrderItem>,
    @InjectRepository(RadiologyTestCatalog)
    private readonly catalogRepo: Repository<RadiologyTestCatalog>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ordersRepo.count({
      where: { radiologyOrderNumber: ILike(`RAD-${year}-%`) },
    });
    return `RAD-${year}-${(count + 1).toString().padStart(6, '0')}`;
  }

  async create(dto: CreateRadiologyOrderDto): Promise<RadiologyOrder> {
    const selected = await this.catalogRepo.find({ where: { id: In(dto.testIds) } });
    if (selected.length === 0) {
      throw new BadRequestException('No valid studies selected');
    }

    const radiologyOrderNumber = await this.generateOrderNumber();
    const order = this.ordersRepo.create({
      radiologyOrderNumber,
      visitId: dto.visitId,
      patientId: dto.patientId,
      notes: dto.notes,
      testName: selected.map((t) => t.name).join(', '),
      status: RadiologyOrderStatus.ORDERED,
      orderedAt: new Date(),
    });
    const saved = await this.ordersRepo.save(order);

    const items = selected.map((t) =>
      this.itemsRepo.create({
        radiologyOrderId: saved.id,
        testCatalogId: t.id,
        testName: t.name,
        category: t.category,
        unitPrice: Number(t.price ?? 0),
      }),
    );
    await this.itemsRepo.save(items);

    return this.findOne(saved.id);
  }

  async findQueue() {
    const orders = await this.ordersRepo.find({
      where: [{ status: RadiologyOrderStatus.ORDERED }, { status: RadiologyOrderStatus.IN_PROGRESS }],
      relations: ['patient', 'visit', 'items'],
      order: { orderedAt: 'ASC' },
    });
    const columns: Record<RadiologyOrderStatus, RadiologyOrder[]> = {
      [RadiologyOrderStatus.ORDERED]: [],
      [RadiologyOrderStatus.IN_PROGRESS]: [],
      [RadiologyOrderStatus.COMPLETED]: [],
      [RadiologyOrderStatus.CANCELLED]: [],
    };
    orders.forEach((o) => columns[o.status].push(o));
    return columns;
  }

  async findAll(status?: RadiologyOrderStatus, patientId?: string) {
    const where: any = {};
    if (status) where.status = status;
    if (patientId) where.patientId = patientId;
    return this.ordersRepo.find({
      where,
      relations: ['patient', 'visit', 'items'],
      order: { orderedAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<RadiologyOrder> {
    const order = await this.ordersRepo.findOne({ where: { id }, relations: ['patient', 'visit', 'items'] });
    if (!order) throw new NotFoundException('Radiology order not found');
    return order;
  }

  async findByVisit(visitId: string): Promise<RadiologyOrder[]> {
    return this.ordersRepo.find({
      where: { visitId },
      relations: ['items'],
      order: { orderedAt: 'DESC' },
    });
  }

  private costOrder(order: RadiologyOrder) {
    const totalRevenue = roundMoney(
      (order.items ?? []).reduce((sum, i) => sum + Number(i.unitPrice ?? 0), 0),
    );
    order.totalRevenue = totalRevenue;
    order.costedAt = new Date();
  }

  async updateStatus(id: string, dto: UpdateRadiologyOrderStatusDto): Promise<RadiologyOrder> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(RadiologyOrder);
      const order = await orderRepo.findOne({ where: { id }, relations: ['items'] });
      if (!order) throw new NotFoundException('Radiology order not found');

      if (dto.status === RadiologyOrderStatus.IN_PROGRESS && !order.startedAt) {
        order.startedAt = new Date();
      }

      if (dto.status === RadiologyOrderStatus.COMPLETED && !order.costedAt) {
        this.costOrder(order);
        order.completedAt = new Date();
      }

      // Cancelling after the scan was already counted as revenue reverses it —
      // a cancelled order must never read as real revenue in the P&L.
      if (
        dto.status === RadiologyOrderStatus.CANCELLED &&
        order.status !== RadiologyOrderStatus.CANCELLED &&
        order.costedAt
      ) {
        order.totalRevenue = null;
        order.costedAt = null;
      }

      order.status = dto.status;
      await orderRepo.save(order);
    });

    return this.findOne(id);
  }

  async updateResult(id: string, dto: UpdateRadiologyResultDto, verifiedByName?: string): Promise<RadiologyOrder> {
    await this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(RadiologyOrder);
      const itemRepo = manager.getRepository(RadiologyOrderItem);

      const order = await orderRepo.findOne({ where: { id }, relations: ['items'] });
      if (!order) throw new NotFoundException('Radiology order not found');
      if (order.status === RadiologyOrderStatus.CANCELLED) {
        throw new BadRequestException('Cannot enter results on a cancelled radiology order');
      }

      const itemsById = new Map(order.items.map((item) => [item.id, item]));
      for (const entry of dto.items) {
        const item = itemsById.get(entry.itemId);
        if (!item) continue;
        item.resultText = entry.resultText;
        await itemRepo.save(item);
      }

      if (!order.costedAt) {
        this.costOrder(order);
      }

      order.status = RadiologyOrderStatus.COMPLETED;
      order.completedAt = order.completedAt ?? new Date();
      if (verifiedByName) order.verifiedByName = verifiedByName;
      await orderRepo.save(order);
    });

    return this.findOne(id);
  }
}
