/**
 * Somcare CMS - add Salary and Org chart permissions.
 *
 * Run from the backend folder:
 *   npx ts-node src/database/seeds/add-salary-orgchart-permissions.ts
 *
 * Safe to re-run. Only ADDS: creates missing permissions and grants them.
 *  - administrator gets every permission listed here
 *  - every other role gets orgchart:read (view the chart). Untick it in Settings
 *    for any role that should not see the org chart.
 *  - salary:* is granted to nobody but administrator; tick it per role in Settings.
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

const NEW_PERMISSIONS = [
  'salary:read',
  'salary:update',
  'orgchart:read',
  'orgchart:create',
  'orgchart:update',
  'orgchart:delete',
];
const READ_FOR_EVERY_ROLE = 'orgchart:read';

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

  const permRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);

  // 1. create missing permissions
  const existing = await permRepo.find({ where: { name: In(NEW_PERMISSIONS) } });
  for (const name of NEW_PERMISSIONS) {
    if (existing.some((p) => p.name === name)) continue;
    const [module, action] = name.split(':');
    await permRepo.save(permRepo.create({ name, module, action, description: `${action} ${module}` } as any));
    console.log(`created permission ${name}`);
  }
  const perms = await permRepo.find({ where: { name: In(NEW_PERMISSIONS) } });
  const byName = new Map(perms.map((p) => [p.name, p]));

  // 2. grant
  const roles = await roleRepo.find({ relations: ['permissions'] });
  for (const role of roles) {
    const wanted =
      role.name === 'administrator'
        ? NEW_PERMISSIONS
        : [READ_FOR_EVERY_ROLE];
    const have = new Set((role.permissions ?? []).map((p) => p.name));
    const toAdd = wanted.filter((n) => !have.has(n)).map((n) => byName.get(n)).filter(Boolean) as Permission[];
    if (!toAdd.length) {
      console.log(`${role.name}: nothing to add`);
      continue;
    }
    role.permissions = [...(role.permissions ?? []), ...toAdd];
    await roleRepo.save(role);
    console.log(`${role.name}: + ${toAdd.map((p) => p.name).join(', ')}`);
  }

  await dataSource.destroy();
  console.log('\nDone! Users must log out and back in to pick up new permissions.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
