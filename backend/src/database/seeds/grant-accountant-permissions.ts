import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const MODULES_TO_GRANT = ['inventory', 'pharmacy'];
const ROLE_NAME = 'accountant';

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

  const role = await roleRepo.findOne({ where: { name: ROLE_NAME }, relations: ['permissions'] });
  if (!role) {
    console.error(`Role '${ROLE_NAME}' not found — nothing to do.`);
    await dataSource.destroy();
    process.exit(1);
  }

  const permsToAdd = await permissionRepo.find({ where: MODULES_TO_GRANT.map((module) => ({ module })) });
  if (permsToAdd.length === 0) {
    console.error(`No permissions found for modules [${MODULES_TO_GRANT.join(', ')}] — check they exist in the permissions table.`);
    await dataSource.destroy();
    process.exit(1);
  }

  const existingIds = new Set(role.permissions.map((p) => p.id));
  const newOnes = permsToAdd.filter((p) => !existingIds.has(p.id));

  if (newOnes.length === 0) {
    console.log(`Role '${ROLE_NAME}' already has all permissions for [${MODULES_TO_GRANT.join(', ')}]. Nothing to add.`);
  } else {
    role.permissions = [...role.permissions, ...newOnes];
    await roleRepo.save(role);
    console.log(`Added ${newOnes.length} permission(s) to '${ROLE_NAME}':`);
    newOnes.forEach((p) => console.log(`  + ${p.name}`));
  }

  console.log(`\n'${ROLE_NAME}' now has ${role.permissions.length} total permissions.`);

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
