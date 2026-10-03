import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const INVENTORY_MODULE = 'inventory';
const GRANT_TO_ROLE = 'laboratory';
const REVOKE_FROM_ROLE = 'pharmacist';

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

  const inventoryPerms = await permissionRepo.find({ where: { module: INVENTORY_MODULE } });
  if (inventoryPerms.length === 0) {
    console.error(`No permissions found for module '${INVENTORY_MODULE}' — check the permissions table.`);
    await dataSource.destroy();
    process.exit(1);
  }
  const inventoryIds = new Set(inventoryPerms.map((p) => p.id));

  // --- Grant inventory:* to laboratory ---
  const labRole = await roleRepo.findOne({ where: { name: GRANT_TO_ROLE }, relations: ['permissions'] });
  if (!labRole) {
    console.error(`Role '${GRANT_TO_ROLE}' not found.`);
  } else {
    const existingIds = new Set(labRole.permissions.map((p) => p.id));
    const newOnes = inventoryPerms.filter((p) => !existingIds.has(p.id));
    if (newOnes.length > 0) {
      labRole.permissions = [...labRole.permissions, ...newOnes];
      await roleRepo.save(labRole);
      console.log(`Added ${newOnes.length} inventory permission(s) to '${GRANT_TO_ROLE}':`);
      newOnes.forEach((p) => console.log(`  + ${p.name}`));
    } else {
      console.log(`Role '${GRANT_TO_ROLE}' already has all inventory permissions.`);
    }
  }

  // --- Revoke inventory:* from pharmacist ---
  const pharmRole = await roleRepo.findOne({ where: { name: REVOKE_FROM_ROLE }, relations: ['permissions'] });
  if (!pharmRole) {
    console.error(`Role '${REVOKE_FROM_ROLE}' not found.`);
  } else {
    const before = pharmRole.permissions.length;
    pharmRole.permissions = pharmRole.permissions.filter((p) => !inventoryIds.has(p.id));
    const removed = before - pharmRole.permissions.length;
    if (removed > 0) {
      await roleRepo.save(pharmRole);
      console.log(`Removed ${removed} inventory permission(s) from '${REVOKE_FROM_ROLE}'.`);
    } else {
      console.log(`Role '${REVOKE_FROM_ROLE}' had no inventory permissions to remove.`);
    }
  }

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
