/**
 * Somcare CMS - add the Manager and Cashier roles.
 *
 * Put this file in backend/src/database/seeds/ (next to grant-accountant-permissions.ts)
 * and run it from the backend folder, the same way you run your other seeds:
 *
 *   npx ts-node src/database/seeds/add-manager-cashier-roles.ts
 *
 * Optional: also create permissions that the frontend checks but that are missing
 * from the permissions table (beds:read, bloodbank:read, departments:read):
 *
 *   npx ts-node src/database/seeds/add-manager-cashier-roles.ts --create-missing
 *
 * Safe to re-run:
 *  - a role that already exists is kept (never duplicated, never deleted)
 *  - permissions are only ever ADDED to a role, never removed
 *  - your other roles are not touched
 */
import { DataSource, In } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const CREATE_MISSING = process.argv.includes('--create-missing');

// Manager: view-only across the hospital. Write access comes from the roles stacked
// on top (Doctor, Nurse, Accountant ...), since a user can hold several roles.
const MANAGER_READ_MODULES = [
  'patients',
  'visits',
  'appointments',
  'queue',
  'triage',
  'consultations',
  'prescriptions',
  'diagnoses',
  'laboratory',
  'radiology',
  'pharmacy',
  'inventory',
  'billing',
  'payments',
  'reports',
  'staff',
  'beds',
  'bloodbank',
  'departments',
];

const ROLES: { name: string; displayName: string; description: string; permissions: string[] }[] = [
  {
    name: 'manager',
    displayName: 'Manager',
    description:
      'Senior oversight: view-only access across clinical, pharmacy, inventory, billing and reports. Combine with a clinical or finance role for write access.',
    permissions: MANAGER_READ_MODULES.map((m) => `${m}:read`),
  },
  {
    name: 'cashier',
    displayName: 'Cashier',
    description: 'Billing counter: look up patients and visits, view billing, take payments.',
    permissions: ['patients:read', 'visits:read', 'billing:read', 'billing:create', 'payments:read', 'payments:create'],
  },
];

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Role, Permission, AuditLog, Patient, Department],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const roleRepo = dataSource.getRepository(Role);
  const permissionRepo = dataSource.getRepository(Permission);

  for (const def of ROLES) {
    console.log(`\n== ${def.displayName} (${def.name}) ==`);

    // 1. make sure every permission we want exists
    let found = await permissionRepo.find({ where: { name: In(def.permissions) } });
    let missing = def.permissions.filter((n) => !found.some((p) => p.name === n));

    if (missing.length && CREATE_MISSING) {
      for (const name of missing) {
        const [module, action] = name.split(':');
        await permissionRepo.save(
          permissionRepo.create({ name, module, action, description: `${action} ${module}` } as any),
        );
        console.log(`  created permission ${name}`);
      }
      found = await permissionRepo.find({ where: { name: In(def.permissions) } });
      missing = def.permissions.filter((n) => !found.some((p) => p.name === n));
    }

    // 2. find or create the role
    let role = await roleRepo.findOne({ where: { name: def.name }, relations: ['permissions'] });
    if (!role) {
      role = roleRepo.create({
        name: def.name,
        displayName: def.displayName,
        description: def.description,
        isActive: true,
        permissions: [],
      } as any) as unknown as Role;
      role = await roleRepo.save(role);
      role.permissions = role.permissions ?? [];
      console.log('  created role');
    } else {
      console.log('  role already exists, keeping it');
      if (role.isActive === false) {
        role.isActive = true;
        console.log('  re-activated role');
      }
    }

    // 3. add only the permissions the role does not have yet
    const have = new Set((role.permissions ?? []).map((p) => p.id));
    const toAdd = found.filter((p) => !have.has(p.id));
    if (toAdd.length) {
      role.permissions = [...(role.permissions ?? []), ...toAdd];
      await roleRepo.save(role);
      toAdd.forEach((p) => console.log(`  + ${p.name}`));
    } else {
      console.log('  no new permissions to add');
    }
    console.log(`  '${def.name}' now has ${role.permissions.length} permission(s)`);

    if (missing.length) {
      console.log('  NOT in the permissions table (skipped):');
      missing.forEach((n) => console.log(`    - ${n}`));
      console.log('  Re-run with --create-missing to add them.');
    }
  }

  await dataSource.destroy();
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
