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

  // 1. Upsert the permission — use QueryBuilder to avoid save() overload ambiguity
  await permRepo
    .createQueryBuilder()
    .insert()
    .into(Permission)
    .values({
      name:        'backup:manage',
      module:      'backup',
      action:      'manage',
      description: 'Create and restore database backups',
    } as any)
    .orIgnore()          // skip if already exists (PostgreSQL ON CONFLICT DO NOTHING)
    .execute();

  const perm = await permRepo.findOneOrFail({ where: { name: 'backup:manage' } });
  console.log(`Permission backup:manage id=${perm.id}`);

  // 2. Grant to administrator and manager
  for (const roleName of ['administrator', 'manager']) {
    const role = await roleRepo.findOne({
      where: { name: roleName },
      relations: ['permissions'],
    });
    if (!role) {
      console.log(`Role '${roleName}' not found — skipping`);
      continue;
    }
    const already = role.permissions.some((p) => p.name === 'backup:manage');
    if (already) {
      console.log(`'${roleName}' already has backup:manage`);
      continue;
    }
    role.permissions = [...role.permissions, perm];
    await roleRepo.save(role);
    console.log(`Granted backup:manage to '${roleName}'`);
  }

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
