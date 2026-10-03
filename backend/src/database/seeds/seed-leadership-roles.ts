import { NestFactory } from '@nestjs/core';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AppModule } from '../../app.module';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { User } from '../../users/entities/user.entity';

interface RoleSpec {
  name: string;
  displayName: string;
  description: string;
  permissions: { module: string; actions: string[] }[];
  assignToUsername: string;
}

// Permission sets designed from the current `permissions` table (25 modules,
// create/read/update/delete/export where applicable). Each leader keeps their
// existing role(s) (manager + doctor/nurse/accountant) — this ADDS a
// leadership role on top, so nothing they already have is removed.
const roleSpecs: RoleSpec[] = [
  {
    name: 'ceo',
    displayName: 'Chief Executive Officer',
    description: 'Executive oversight across the organization',
    permissions: [
      { module: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'orgchart', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'staff', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'settings', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'salary', actions: ['read', 'update'] },
      { module: 'users', actions: ['read'] },
      { module: 'roles', actions: ['read'] },
      { module: 'audit', actions: ['read'] },
      { module: 'departments', actions: ['read'] },
      { module: 'billing', actions: ['read'] },
      { module: 'payments', actions: ['read'] },
      { module: 'patients', actions: ['read'] },
      { module: 'appointments', actions: ['read'] },
      { module: 'visits', actions: ['read'] },
      { module: 'consultations', actions: ['read'] },
      { module: 'pharmacy', actions: ['read'] },
      { module: 'inventory', actions: ['read'] },
      { module: 'laboratory', actions: ['read'] },
      { module: 'radiology', actions: ['read'] },
      { module: 'bloodbank', actions: ['read'] },
      { module: 'beds', actions: ['read'] },
      { module: 'queue', actions: ['read'] },
      { module: 'triage', actions: ['read'] },
      { module: 'diagnoses', actions: ['read'] },
      { module: 'prescriptions', actions: ['read'] },
    ],
    assignToUsername: 'ceo',
  },
  {
    name: 'medical_director',
    displayName: 'Medical Director',
    description: 'Clinical governance across departments',
    permissions: [
      { module: 'consultations', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'diagnoses', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'prescriptions', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'laboratory', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'radiology', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'visits', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'triage', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'queue', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'patients', actions: ['create', 'read', 'update', 'export'] },
      { module: 'staff', actions: ['read', 'update'] },
      { module: 'reports', actions: ['read', 'export'] },
      { module: 'orgchart', actions: ['read'] },
      { module: 'departments', actions: ['read'] },
      { module: 'audit', actions: ['read'] },
      { module: 'bloodbank', actions: ['read'] },
      { module: 'beds', actions: ['read'] },
    ],
    assignToUsername: 'medical.director',
  },
  {
    name: 'chief_nursing_officer',
    displayName: 'Chief Nursing Officer',
    description: 'Nursing operations oversight',
    permissions: [
      { module: 'triage', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'queue', actions: ['create', 'read', 'update', 'delete'] },
      { module: 'beds', actions: ['read'] },
      { module: 'consultations', actions: ['read'] },
      { module: 'visits', actions: ['read', 'update'] },
      { module: 'patients', actions: ['read', 'update'] },
      { module: 'diagnoses', actions: ['read'] },
      { module: 'prescriptions', actions: ['read'] },
      { module: 'staff', actions: ['read', 'update'] },
      { module: 'reports', actions: ['read', 'export'] },
      { module: 'orgchart', actions: ['read'] },
      { module: 'departments', actions: ['read'] },
    ],
    assignToUsername: 'cno',
  },
  {
    name: 'chief_admin_officer',
    displayName: 'Chief Admin Officer',
    description: 'Administrative and financial oversight',
    permissions: [
      { module: 'billing', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'payments', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'inventory', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'pharmacy', actions: ['read'] },
      { module: 'staff', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'settings', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'reports', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { module: 'salary', actions: ['read', 'update'] },
      { module: 'audit', actions: ['read'] },
      { module: 'orgchart', actions: ['read'] },
      { module: 'departments', actions: ['read'] },
      { module: 'users', actions: ['read'] },
    ],
    assignToUsername: 'cao',
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const rolesRepo: Repository<Role> = app.get(getRepositoryToken(Role));
  const permsRepo: Repository<Permission> = app.get(getRepositoryToken(Permission));
  const usersRepo: Repository<User> = app.get(getRepositoryToken(User));

  const allPerms = await permsRepo.find();
  const permMap = new Map(allPerms.map((p) => [`${p.module}:${p.action}`, p]));

  for (const spec of roleSpecs) {
    console.log(`\n== ${spec.displayName} (${spec.name}) ==`);

    let role = await rolesRepo.findOne({ where: { name: spec.name } });
    if (role) {
      console.log(`  role '${spec.name}' already exists, refreshing its permissions`);
    } else {
      role = rolesRepo.create({
        name: spec.name,
        displayName: spec.displayName,
        description: spec.description,
        permissions: [],
      } as any) as unknown as Role;
      role = await rolesRepo.save(role);
      console.log(`  created role '${spec.name}'`);
    }

    const wanted: string[] = [];
    for (const { module, actions } of spec.permissions) {
      for (const action of actions) wanted.push(`${module}:${action}`);
    }
    const resolved: Permission[] = [];
    const missing: string[] = [];
    for (const key of wanted) {
      const p = permMap.get(key);
      if (p) resolved.push(p);
      else missing.push(key);
    }
    if (missing.length) {
      console.log(`  WARNING: no permission row for: ${missing.join(', ')}`);
    }
    role.permissions = resolved;
    await rolesRepo.save(role);
    console.log(`  assigned ${resolved.length} permissions`);

    const user = await usersRepo.findOne({
      where: { username: spec.assignToUsername },
      relations: ['roles'],
    });
    if (!user) {
      console.log(`  ERROR: no user with username '${spec.assignToUsername}'`);
      continue;
    }
    const alreadyHasRole = user.roles.some((r) => r.name === spec.name);
    if (alreadyHasRole) {
      console.log(`  user '${spec.assignToUsername}' already has role '${spec.name}'`);
    } else {
      user.roles = [...user.roles, role];
      await usersRepo.save(user);
      console.log(
        `  linked role '${spec.name}' -> user '${spec.assignToUsername}' (roles now: ${user.roles.map((r) => r.name).join(', ')})`,
      );
    }
  }

  console.log('\nDone! Each leader now has their existing role(s) plus their new leadership role.');
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
