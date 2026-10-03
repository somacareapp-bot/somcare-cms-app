import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgChartNode, NodeStatus } from './entities/org-chart-node.entity';
import { CreateOrgChartNodeDto, UpdateOrgChartNodeDto } from './dto/org-chart.dto';
import { User, UserStatus } from '../users/entities/user.entity';

@Injectable()
export class OrgChartService implements OnModuleInit {
  constructor(
    @InjectRepository(OrgChartNode)
    private readonly repo: Repository<OrgChartNode>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async onModuleInit() {
    const count = await this.repo.count();
    if (count === 0) await this.seed();
  }

  // For linked nodes (linkType + linkValue set), headcount is computed live
  // from active users so it never drifts from the Staff page. Unlinked nodes
  // (e.g. Board of Directors, Patients and Community) keep their stored value.
  private async attachLiveHeadcounts(nodes: OrgChartNode[]): Promise<OrgChartNode[]> {
    const linked = nodes.filter((n) => n.linkType && n.linkValue);
    if (linked.length === 0) return nodes;

    const positionCounts = new Map<string, number>();
    const departmentCounts = new Map<string, number>();
    const roleCounts = new Map<string, number>();

    const needsPosition = linked.some((n) => n.linkType === 'position');
    const needsDepartment = linked.some((n) => n.linkType === 'department');
    const needsRole = linked.some((n) => n.linkType === 'role');

    if (needsPosition) {
      const rows = await this.usersRepo
        .createQueryBuilder('user')
        .select('LOWER(TRIM(user.position))', 'position')
        .addSelect('COUNT(*)', 'count')
        .where('user.status = :status', { status: UserStatus.ACTIVE })
        .andWhere('user.position IS NOT NULL')
        .andWhere("TRIM(user.position) != ''")
        .groupBy('LOWER(TRIM(user.position))')
        .getRawMany<{ position: string; count: string }>();
      rows.forEach((r) => positionCounts.set(r.position, Number(r.count)));
    }

    if (needsDepartment) {
      const rows = await this.usersRepo
        .createQueryBuilder('user')
        .select('user.departmentId', 'departmentId')
        .addSelect('COUNT(*)', 'count')
        .where('user.status = :status', { status: UserStatus.ACTIVE })
        .andWhere('user.departmentId IS NOT NULL')
        .groupBy('user.departmentId')
        .getRawMany<{ departmentId: string; count: string }>();
      rows.forEach((r) => departmentCounts.set(r.departmentId, Number(r.count)));
    }

    if (needsRole) {
      const rows = await this.usersRepo
        .createQueryBuilder('user')
        .innerJoin('user.roles', 'role')
        .select('role.name', 'roleName')
        .addSelect('COUNT(DISTINCT user.id)', 'count')
        .where('user.status = :status', { status: UserStatus.ACTIVE })
        .groupBy('role.name')
        .getRawMany<{ roleName: string; count: string }>();
      rows.forEach((r) => roleCounts.set(r.roleName, Number(r.count)));
    }

    return nodes.map((n) => {
      if (!n.linkType || !n.linkValue) return n;
      let live = 0;
      if (n.linkType === 'position') live = positionCounts.get(n.linkValue.trim().toLowerCase()) ?? 0;
      else if (n.linkType === 'department') live = departmentCounts.get(n.linkValue) ?? 0;
      else if (n.linkType === 'role') live = roleCounts.get(n.linkValue) ?? 0;
      return { ...n, headcount: live };
    });
  }

  async getTree(): Promise<OrgChartNode[]> {
    const all = await this.repo.find({ order: { order: 'ASC' } });
    const withLive = await this.attachLiveHeadcounts(all);
    return this.buildTree(withLive);
  }

  private buildTree(nodes: OrgChartNode[], parentId: string | null = null): OrgChartNode[] {
    return nodes
      .filter((n) => (n.parentId ?? null) === parentId)
      .map((n) => ({ ...n, children: this.buildTree(nodes, n.id) }));
  }

  async findAll(): Promise<OrgChartNode[]> {
    const all = await this.repo.find({ order: { order: 'ASC' } });
    return this.attachLiveHeadcounts(all);
  }

  async findOne(id: string): Promise<OrgChartNode> {
    const node = await this.repo.findOne({ where: { id }, relations: ['parent', 'children'] });
    if (!node) throw new NotFoundException(`Node ${id} not found`);
    const [withLive] = await this.attachLiveHeadcounts([node]);
    return withLive;
  }

  async create(dto: CreateOrgChartNodeDto): Promise<OrgChartNode> {
    const node = this.repo.create(dto);
    return this.repo.save(node);
  }

  async update(id: string, dto: UpdateOrgChartNodeDto): Promise<OrgChartNode> {
    const node = await this.findOne(id);
    const { parentId, ...rest } = dto;
    Object.assign(node, rest);

    if (parentId !== undefined) {
      if (parentId === id) throw new BadRequestException('A role cannot be its own parent');
      if (parentId) {
        // block cycles: the new parent must not be one of this node's descendants
        const all = await this.repo.find();
        const byParent = new Map<string, string[]>();
        all.forEach((n) => {
          if (n.parentId) byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n.id]);
        });
        const stack = [...(byParent.get(id) ?? [])];
        while (stack.length) {
          const cur = stack.pop() as string;
          if (cur === parentId) throw new BadRequestException('A role cannot report to one of its own reports');
          stack.push(...(byParent.get(cur) ?? []));
        }
      }
      // set the relation itself; TypeORM ignores a changed parentId column while the old parent object is loaded
      node.parent = parentId ? ({ id: parentId } as OrgChartNode) : (null as any);
      node.parentId = (parentId ?? null) as any;
    }
    return this.repo.save(node);
  }

  async remove(id: string): Promise<void> {
    const node = await this.findOne(id);
    await this.repo.remove(node);
  }

  private async seed() {
    const save = async (data: Partial<OrgChartNode>) => this.repo.save(this.repo.create(data));

    const board = await save({ title: 'Board of Directors', subtitle: 'Governance and oversight', location: 'Hargeisa HQ', headcount: 12, order: 0 });
    const ceo   = await save({ title: 'Chief Executive Officer', subtitle: 'Strategic leadership', location: 'Hargeisa HQ', headcount: 1, order: 1, parentId: board.id });
    const md    = await save({ title: 'Medical Director', subtitle: 'Clinical governance', department: 'Clinical', location: 'Clinical wing', headcount: 1, order: 2, parentId: ceo.id });
    const cno   = await save({ title: 'Chief Nursing Officer', subtitle: 'Nursing operations', department: 'Nursing', location: 'Nursing wing', headcount: 1, order: 3, parentId: ceo.id });
    const cao   = await save({ title: 'Chief Admin Officer', subtitle: 'Admin and finance', department: 'Administration', location: 'Admin block', headcount: 1, order: 4, parentId: ceo.id });
    await save({ title: 'Department Heads', subtitle: 'Lead clinical departments', department: 'Clinical', headcount: 8, order: 5, parentId: md.id });
    await save({ title: 'Specialist Physicians', subtitle: 'Clinical specialists', department: 'Clinical', headcount: 24, order: 6, parentId: md.id });
    await save({ title: 'Ward Supervisors', subtitle: 'Manage ward operations', department: 'Nursing', headcount: 6, order: 7, parentId: cno.id });
    await save({ title: 'Charge Nurses', subtitle: 'Lead nursing shifts', department: 'Nursing', headcount: 12, order: 8, parentId: cno.id });
    await save({ title: 'HR and Finance Managers', subtitle: 'Admin management', department: 'Administration', headcount: 4, order: 9, parentId: cao.id });
    await save({ title: 'Support Services', subtitle: 'Facilities and logistics', department: 'Operations', headcount: 10, order: 10, parentId: cao.id });
    const fl = await save({ title: 'Frontline Staff', subtitle: 'Nurses · Doctors · Technicians · Admin · Support workers', headcount: 180, order: 11, parentId: ceo.id });
    await save({ title: 'Patients and Community', subtitle: 'Center of care', location: 'Hargeisa region', order: 12, parentId: fl.id });
  }
}
