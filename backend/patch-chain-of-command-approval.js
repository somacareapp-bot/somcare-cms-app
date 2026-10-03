// patch-chain-of-command-approval.js
// Replaces the flat "department head -> admin" expense approval flow with
// a single-stage chain-of-command lookup:
//   staff -> their department head -> Medical Director -> CEO
//   nurse -> Chief Nursing Officer -> CEO
//   accountant/reception/headless-department staff -> Chief Admin Officer -> CEO
// Whoever the resolved approver is, one approval sends the expense straight
// to "Awaiting Payment" — there is no longer a separate second admin stage.
//
// Run from the backend folder: node patch-chain-of-command-approval.js

const fs = require('fs');

const SERVICE_PATH = '/Users/adminnopassword/Documents/Clinical MS/cms/backend/src/expenses/expenses.service.ts';

function patchFile(path, replacements, label) {
  let content = fs.readFileSync(path, 'utf8');
  for (const { find, replace, name } of replacements) {
    if (content.includes(replace)) {
      console.log(`[${label}] "${name}" already present — skipping.`);
      continue;
    }
    if (!content.includes(find)) {
      throw new Error(
        `[${label}] Could not find anchor text for "${name}". ` +
        `The file may have changed since this script was written — aborting without modifying anything.`
      );
    }
    content = content.replace(find, replace);
    console.log(`[${label}] Applied "${name}".`);
  }
  fs.writeFileSync(path, content, 'utf8');
}

patchFile(
  SERVICE_PATH,
  [
    {
      name: 'UserStatus import',
      find: `import { User } from '../users/entities/user.entity';`,
      replace: `import { User, UserStatus } from '../users/entities/user.entity';`,
    },
    {
      name: 'getDeptHeadQueue rewrite + resolveApproverId + getTopUser',
      find: `  // Expenses in PENDING status where the caller is the department head of
  // the submitter's department (or is an admin, who may act at any stage —
  // mirrors the permission check in deptHeadReview()).
  async getDeptHeadQueue(userId: string, isAdmin: boolean) {
    const pending = await this.expensesRepo.find({
      where: { status: ExpenseStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (pending.length === 0) return [];
    if (isAdmin) return pending;

    const departmentRepo = this.usersRepo.manager.getRepository(Department);
    const headedDepts = await departmentRepo.find({ where: { headDoctorId: userId } });
    if (headedDepts.length === 0) return [];
    const headedDeptIds = new Set(headedDepts.map((d) => d.id));

    const submitterIds = Array.from(new Set(pending.map((e) => e.submittedById)));
    const submitters = await this.usersRepo.find({ where: { id: In(submitterIds) } });
    const deptByUserId = new Map(submitters.map((u) => [u.id, u.departmentId]));

    return pending.filter((e) => {
      const deptId = deptByUserId.get(e.submittedById);
      return deptId && headedDeptIds.has(deptId);
    });
  }`,
      replace: `  // Expenses in PENDING status where the caller is the resolved next
  // approver in the chain of command for the submitter (or is an admin,
  // who may act at any stage).
  async getDeptHeadQueue(userId: string, isAdmin: boolean) {
    const pending = await this.expensesRepo.find({
      where: { status: ExpenseStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
    if (pending.length === 0) return [];
    if (isAdmin) return pending;

    const results: Expense[] = [];
    for (const e of pending) {
      const approverId = await this.resolveApproverId(e.submittedById);
      if (approverId === userId) results.push(e);
    }
    return results;
  }

  // Look up the single active user holding a given top-level title
  // (e.g. 'medical director', 'chief executive officer').
  private async getTopUser(titleLower: string): Promise<User | null> {
    return this.usersRepo
      .createQueryBuilder('user')
      .where('LOWER(TRIM(user.position)) = :title', { title: titleLower })
      .andWhere('user.status = :status', { status: UserStatus.ACTIVE })
      .getOne();
  }

  // Chain of command: who approves this person's expenses.
  //  - Doctor / specialist in a department with a head -> that department head
  //  - A department head -> Medical Director
  //  - Medical Director -> CEO
  //  - Chief Nursing Officer / Chief Admin Officer -> CEO
  //  - Nurse -> Chief Nursing Officer
  //  - Everyone else (accountants, reception, staff in a headless department,
  //    storekeepers, etc.) -> Chief Admin Officer
  //  - CEO -> null (top of the chain; admin can still act directly)
  async resolveApproverId(submittedById: string): Promise<string | null> {
    const submitter = await this.usersRepo.findOne({ where: { id: submittedById }, relations: ['department'] });
    if (!submitter) return null;
    const position = (submitter.position || '').trim().toLowerCase();

    if (position === 'ceo' || position === 'chief executive officer') return null;

    if (position === 'medical director') {
      const ceo = await this.getTopUser('chief executive officer');
      return ceo?.id ?? null;
    }

    if (position === 'chief nursing officer' || position === 'chief admin officer') {
      const ceo = await this.getTopUser('chief executive officer');
      return ceo?.id ?? null;
    }

    const departmentRepo = this.usersRepo.manager.getRepository(Department);

    // Is this person the head of some department? Then they escalate to
    // the Medical Director, regardless of what their position text says.
    const headedDept = await departmentRepo.findOne({ where: { headDoctorId: submittedById } });
    if (headedDept) {
      const md = await this.getTopUser('medical director');
      return md?.id ?? null;
    }

    // Regular staff in a department that has a head.
    if (submitter.departmentId) {
      const dept = submitter.department ?? (await departmentRepo.findOne({ where: { id: submitter.departmentId } }));
      if (dept?.headDoctorId) return dept.headDoctorId;
    }

    // Nurses aren't tied to a department row in this system.
    if (position.includes('nurse')) {
      const cno = await this.getTopUser('chief nursing officer');
      return cno?.id ?? null;
    }

    // Fallback: accountants, receptionists, storekeepers, staff in a
    // headless department (e.g. Surgery), or anything unrecognized.
    const cao = await this.getTopUser('chief admin officer');
    return cao?.id ?? null;
  }`,
    },
    {
      name: 'deptHeadReview: permission check + single-stage status transition',
      find: `    if (!isAdmin) {
      const deptHeadId = await this.findDeptHeadId(expense.submittedById);
      if (!deptHeadId || deptHeadId !== userId) {
        throw new ForbiddenException('You are not the department head for this submitter');
      }
    }

    const approved = dto.decision === DeptHeadDecision.APPROVE;
    expense.status = approved ? ExpenseStatus.DEPT_HEAD_APPROVED : ExpenseStatus.DEPT_HEAD_REJECTED;
    expense.deptHeadApprovedById = userId;
    expense.deptHeadApprovedByName = userName;
    expense.deptHeadApprovedAt = new Date();
    expense.deptHeadNotes = dto.notes ?? '';
    expense.deptHeadAutoSkipped = false;
    expense.updatedBy = userId;
    const saved = await this.expensesRepo.save(expense);

    if (approved) {
      // Stage 2: notify admins — this now goes straight to admin approval.
      await this.notifyRoles([], {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: \`\${userName} approved an expense — ready for admin approval: \${expense.description}\`,
        link: '/billing/expenses',
        meta: { expenseId: saved.id },
      });
    } else {`,
      replace: `    if (!isAdmin) {
      const approverId = await this.resolveApproverId(expense.submittedById);
      if (!approverId || approverId !== userId) {
        throw new ForbiddenException('You are not the approver for this submitter');
      }
    }

    const approved = dto.decision === DeptHeadDecision.APPROVE;
    expense.status = approved ? ExpenseStatus.APPROVED : ExpenseStatus.DEPT_HEAD_REJECTED;
    expense.deptHeadApprovedById = userId;
    expense.deptHeadApprovedByName = userName;
    expense.deptHeadApprovedAt = new Date();
    expense.deptHeadNotes = dto.notes ?? '';
    expense.deptHeadAutoSkipped = false;
    if (approved) {
      expense.approvedById = userId;
      expense.approvedByName = userName;
      expense.approvedAt = new Date();
    }
    expense.updatedBy = userId;
    const saved = await this.expensesRepo.save(expense);

    if (approved) {
      // Single-stage chain-of-command approval — this now goes straight to payment.
      await this.notifyRoles(['accountant'], {
        actorName: userName,
        actorAvatarUrl: userAvatar,
        message: \`\${userName} approved an expense — ready for payment: \${expense.description}\`,
        link: '/billing/expenses',
        meta: { expenseId: saved.id },
      });
    } else {`,
    },
  ],
  'service'
);

console.log('\nDone. Restart the backend.');
console.log('One approval now sends an expense straight to "Awaiting Payment" — the separate');
console.log('admin-approval stage is no longer used. The "Awaiting My Review" tab now follows');
console.log('the full chain of command for every role, not just flat department heads.');
