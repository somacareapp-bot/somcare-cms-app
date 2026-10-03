import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { ActivityLog } from '../../activity-log/activity-log.entity';
import { Department } from '../../departments/entities/department.entity';

// Same normalization as ActivityLoggingInterceptor.roleNames() -- kept in sync
// by hand since this is a one-off repair script, not shared code.
function roleNames(roles: unknown): string | null {
  if (!Array.isArray(roles) || !roles.length) return null;
  return (
    roles
      .map((r: any) => (typeof r === 'string' ? r : r?.name ?? r?.displayName ?? null))
      .filter(Boolean)
      .join(', ') || null
  );
}

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Role, Permission, ActivityLog, Department],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const activityLogsRepo = dataSource.getRepository(ActivityLog);
  const userRepo = dataSource.getRepository(User);

  // Only touch rows that actually look broken -- leave anything already correct alone.
  const broken = await activityLogsRepo
    .createQueryBuilder('log')
    .where("log.user_role LIKE '%[object Object]%'")
    .orWhere('log.user_role IS NULL')
    .getMany();

  if (broken.length === 0) {
    console.log('No broken rows found. Nothing to do.');
    await dataSource.destroy();
    return;
  }

  console.log(`Found ${broken.length} row(s) to repair.`);
  let fixed = 0;
  let skipped = 0;

  for (const log of broken) {
    if (!log.userId) {
      skipped++;
      continue;
    }
    const user = await userRepo.findOne({ where: { id: log.userId }, relations: ['roles'] });
    if (!user) {
      skipped++;
      continue;
    }
    const newRole = roleNames(user.roles);
    if (newRole === log.userRole) continue;
    log.userRole = newRole;
    await activityLogsRepo.save(log);
    fixed++;
    console.log(`  fixed log ${log.id} (${log.userName ?? log.userId}) -> "${newRole}"`);
  }

  console.log(`Done. Fixed ${fixed}, skipped ${skipped} (no matching user).`);
  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
