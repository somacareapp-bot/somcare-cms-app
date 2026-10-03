import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

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

  const permissionsToCreate = [
    { name: 'staff:read', module: 'staff', action: 'read', description: 'View staff profiles (personal info, experience, education, CV)' },
    { name: 'staff:update', module: 'staff', action: 'update', description: 'Edit staff profiles and upload/replace CVs' },
  ];

  const createdPerms: Permission[] = [];

  for (const p of permissionsToCreate) {
    // 1. Upsert the permission — use QueryBuilder to avoid save() overload ambiguity
    await permRepo
      .createQueryBuilder()
      .insert()
      .into(Permission)
      .values(p as any)
      .orIgnore() // skip if already exists (PostgreSQL ON CONFLICT DO NOTHING)
      .execute();

    const perm = await permRepo.findOneOrFail({ where: { name: p.name } });
    console.log(`Permission ${p.name} id=${perm.id}`);
    createdPerms.push(perm);
  }

  // 2. Grant both permissions to administrator and manager roles.
  //    Adjust this role list if HR-type duties sit on a different role
  //    (e.g. 'hr', 'receptionist') in your role table.
  for (const roleName of ['administrator', 'manager']) {
    const role = await roleRepo.findOne({
      where: { name: roleName },
      relations: ['permissions'],
    });
    if (!role) {
      console.log(`Role '${roleName}' not found — skipping`);
      continue;
    }

    const existingNames = new Set(role.permissions.map((p) => p.name));
    const toAdd = createdPerms.filter((p) => !existingNames.has(p.name));

    if (toAdd.length === 0) {
      console.log(`'${roleName}' already has all staff-profile permissions`);
      continue;
    }

    role.permissions = [...role.permissions, ...toAdd];
    await roleRepo.save(role);
    console.log(`Granted [${toAdd.map((p) => p.name).join(', ')}] to '${roleName}'`);
  }

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
