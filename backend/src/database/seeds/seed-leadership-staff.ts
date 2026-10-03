/**
 * Somcare CMS - create the four leadership staff accounts and link them
 * to the org chart so their boxes show a live headcount.
 *
 * Run from the backend folder:
 *   npx ts-node src/database/seeds/seed-leadership-staff.ts
 *
 * Safe to re-run: skips any username that already exists rather than
 * erroring or duplicating. Each new user gets mustChangePassword = true,
 * so the password below is only a first-login value.
 */
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';
import { OrgChartNode } from '../../org-chart/entities/org-chart-node.entity';

interface LeaderSpec {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  position: string;
  roleNames: string[];
  orgChartTitle: string;
}

const LEADERS: LeaderSpec[] = [
  {
    username: 'ceo',
    password: process.env.SEED_PASSWORD || 'ChangeMe-OnFirstLogin',
    firstName: 'Ahmed',
    lastName: 'Hassan',
    position: 'Chief Executive Officer',
    roleNames: ['manager'],
    orgChartTitle: 'Chief Executive Officer',
  },
  {
    username: 'medical.director',
    password: process.env.SEED_PASSWORD || 'ChangeMe-OnFirstLogin',
    firstName: 'Dr. Mohamed',
    lastName: 'Ali',
    position: 'Medical Director',
    roleNames: ['manager', 'doctor'],
    orgChartTitle: 'Medical Director',
  },
  {
    username: 'cno',
    password: process.env.SEED_PASSWORD || 'ChangeMe-OnFirstLogin',
    firstName: 'Amina',
    lastName: 'Yusuf',
    position: 'Chief Nursing Officer',
    roleNames: ['manager', 'nurse'],
    orgChartTitle: 'Chief Nursing Officer',
  },
  {
    username: 'cao',
    password: process.env.SEED_PASSWORD || 'ChangeMe-OnFirstLogin',
    firstName: 'Hassan',
    lastName: 'Omar',
    position: 'Chief Admin Officer',
    roleNames: ['manager', 'accountant'],
    orgChartTitle: 'Chief Admin Officer',
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
    entities: [User, Role, Permission, AuditLog, Patient, Department, OrgChartNode],
    synchronize: false,
  });

  await dataSource.initialize();
  console.log('Connected to database');

  const usersRepo = dataSource.getRepository(User);
  const rolesRepo = dataSource.getRepository(Role);
  const nodesRepo = dataSource.getRepository(OrgChartNode);

  for (const leader of LEADERS) {
    console.log(`\n== ${leader.firstName} ${leader.lastName} (${leader.username}) ==`);

    const existingUser = await usersRepo.findOne({ where: { username: leader.username } });
    if (existingUser) {
      console.log(`  user '${leader.username}' already exists, skipping creation`);
    } else {
      const roles = await rolesRepo.findBy({ name: In(leader.roleNames) });
      const foundNames = roles.map((r) => r.name);
      const missing = leader.roleNames.filter((n) => !foundNames.includes(n));
      if (missing.length) {
        console.error(`  ERROR: role(s) not found in DB: ${missing.join(', ')} — skipping this user`);
        continue;
      }

      const passwordHash = await bcrypt.hash(leader.password, 10);
      const user = usersRepo.create({
        username: leader.username,
        passwordHash,
        firstName: leader.firstName,
        lastName: leader.lastName,
        position: leader.position,
        status: 'active' as any,
        mustChangePassword: true,
        roles,
      });
      await usersRepo.save(user);
      console.log(`  created user with roles: ${foundNames.join(', ')}`);
      console.log(`  temp password: ${leader.password}  (must change on first login)`);
    }

    // Link the matching org chart node to this position, so headcount goes live
    const node = await nodesRepo.findOne({ where: { title: leader.orgChartTitle } });
    if (!node) {
      console.error(`  ERROR: no org_chart_nodes row with title '${leader.orgChartTitle}' — link skipped`);
      continue;
    }
    node.linkType = 'position';
    node.linkValue = leader.position;
    await nodesRepo.save(node);
    console.log(`  linked org chart node '${leader.orgChartTitle}' -> position '${leader.position}'`);
  }

  await dataSource.destroy();
  console.log('\nDone! New users must log in once and set a real password (mustChangePassword is set).');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
