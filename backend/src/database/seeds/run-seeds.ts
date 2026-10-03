import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { runInitialSeed } from './initial-seed';
import { runTestUsersSeed } from './test-users-seed';

async function main() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    entities: [User, Role, Permission, AuditLog, Patient],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  await runInitialSeed(dataSource);
  await runTestUsersSeed(dataSource);

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
