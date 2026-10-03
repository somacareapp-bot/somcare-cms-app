import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrgChartNode } from '../org-chart/entities/org-chart-node.entity';
import { User } from '../users/entities/user.entity';
import { Department } from '../departments/entities/department.entity';

// One place that answers "who approves this person's request?". Every section
// with an approval step (expenses, pharmacy purchases, lab-supply purchases...)
// asks this service, so changing the Org chart or Departments page changes all of them.
@Injectable()
export class ApprovalRoutingService {
  constructor(
    @InjectRepository(OrgChartNode) private readonly orgChartRepo: Repository<OrgChartNode>,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(Department) private readonly departmentsRepo: Repository<Department>,
  ) {}

  // Order:
  //  1. A person linked to the submitter's own group box (e.g. one person on "Doctors").
  //  2. Otherwise the head of the submitter's own department (Departments page).
  //  3. Otherwise the first linked person walking up the org chart.
  //  4. Nobody found -> null (admin handles it).
  async resolveApproverId(submittedById: string): Promise<string | null> {
    const [nodes, user] = await Promise.all([
      this.orgChartRepo.find(),
      this.usersRepo.findOne({ where: { id: submittedById }, relations: ['roles'] }),
    ]);
    if (!user) return null;
    const byId = new Map(nodes.map((n) => [n.id, n]));

    let start: OrgChartNode | undefined;
    let ownBox = false;
    const own = nodes.find((n) => n.linkedUserId === submittedById);
    if (own) {
      start = own;
      ownBox = true;
    } else {
      const position = (user.position || '').trim().toLowerCase();
      const roleKeys = new Set<string>(
        ((user as any).roles ?? []).flatMap((r: any) => [r.id, r.name]).filter(Boolean),
      );
      const linked = nodes.filter((n) => n.linkType && n.linkValue && String(n.status) === 'active');
      start =
        linked.find((n) => n.linkType === 'department' && !!user.departmentId && n.linkValue === user.departmentId) ??
        linked.find((n) => n.linkType === 'position' && !!position && (n.linkValue as string).trim().toLowerCase() === position) ??
        linked.find((n) => n.linkType === 'role' && roleKeys.has(n.linkValue as string));
    }

    // 1. group box with a person
    if (start && !ownBox && start.linkedUserId) return start.linkedUserId;

    // 2. own department head (the head themselves skips this)
    if (user.departmentId) {
      const dept = await this.departmentsRepo.findOne({ where: { id: user.departmentId } });
      if (dept?.headDoctorId && dept.headDoctorId !== submittedById) return dept.headDoctorId;
    }

    // 3. walk up the org chart
    if (!start) return null;
    let current: OrgChartNode | undefined = ownBox
      ? (start.parentId ? byId.get(start.parentId) : undefined)
      : start;
    const seen = new Set<string>();
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.linkedUserId && current.linkedUserId !== submittedById) return current.linkedUserId;
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return null;
  }

  // True when the user is linked to an org chart box or heads a department.
  async isApprover(userId: string): Promise<boolean> {
    if ((await this.orgChartRepo.count({ where: { linkedUserId: userId } })) > 0) return true;
    return (await this.departmentsRepo.count({ where: { headDoctorId: userId } })) > 0;
  }
}
