/**
 * Somcare CMS - seed the full 150-person staff list into the users table.
 *
 * Reads backend/seed/somcare_staff_seed.json. Run from the backend folder:
 *
 *   npx ts-node src/database/seeds/seed-full-staff.ts --dry-run   (preview, writes nothing)
 *   npx ts-node src/database/seeds/seed-full-staff.ts             (real run)
 *
 * Safe to re-run:
 *  - a username that already exists is skipped (never duplicated or overwritten)
 *  - missing departments are created; existing ones are reused
 *  - a department head is only set if the department has none yet
 *  - all writes happen in ONE transaction: all or nothing
 * New users get mustChangePassword = true, so the seed password is first-login only.
 */
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config();

import { User, UserStatus, Language } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const DRY_RUN = process.argv.includes('--dry-run');
const SEED_FILE = path.join(__dirname, '../../../seed/somcare_staff_seed.json');
const BCRYPT_ROUNDS = 12;

interface SeedRow {
  id: number;
  full_name: string;
  title: string;
  name: string; // full name without Dr./Nurse/Receptionist
  username: string;
  password: string;
  position: string;
  department: string;
  org_chart_group: string;
}

// Seed-file department name -> the name already used in your departments table.
const DEPT_ALIASES: Record<string, string> = {
  'Intensive Care Unit': 'Intensive Care Unit (ICU)',
  ENT: 'ENT (Ear, Nose & Throat)',
  'Outpatient Department': 'Outpatient Department (OPD)',
  'Inpatient Department': 'Inpatient Department (IPD)',
};

// Which system role(s) each position gets. Edit here if you want different access
// (e.g. add 'manager' to 'Department Head' for view-only hospital-wide oversight).
const ROLES_BY_POSITION: Record<string, string[]> = {
  'Department Head': ['doctor'],
  'Specialist Physician': ['doctor'],
  Doctor: ['doctor'],
  Nurse: ['nurse'],
  'Reception Staff': ['receptionist'],
  'Pharmacist / Pharmacy Manager': ['pharmacist'],
  Pharmacist: ['pharmacist'],
  'Laboratory Head': ['laboratory'],
  'Laboratory Staff': ['laboratory'],
  Accountant: ['accountant'],
};

async function main() {
  const rows: SeedRow[] = JSON.parse(fs.readFileSync(SEED_FILE, 'utf-8'));
  console.log(`Loaded ${rows.length} staff from seed file${DRY_RUN ? '  (DRY RUN - nothing will be written)' : ''}`);

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

  // ---- validate roles + positions up front ----
  const roles = await dataSource.getRepository(Role).find();
  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const neededRoles = new Set<string>();
  for (const r of rows) {
    const mapped = ROLES_BY_POSITION[r.position];
    if (!mapped) {
      console.error(`Unknown position "${r.position}" (${r.username}) - add it to ROLES_BY_POSITION.`);
      await dataSource.destroy();
      process.exit(1);
    }
    mapped.forEach((n) => neededRoles.add(n));
  }
  const missingRoles = Array.from(neededRoles).filter((n) => !roleByName.has(n));
  if (missingRoles.length) {
    console.error(`Missing roles in the roles table: ${missingRoles.join(', ')}`);
    await dataSource.destroy();
    process.exit(1);
  }

  // ---- departments ----
  const existingDepts = await dataSource.getRepository(Department).find();
  const deptByName = new Map(existingDepts.map((d) => [d.name, d]));
  const resolveDept = (n: string) => (deptByName.has(n) ? n : DEPT_ALIASES[n] && deptByName.has(DEPT_ALIASES[n]) ? DEPT_ALIASES[n] : DEPT_ALIASES[n] && !deptByName.has(n) ? n : n);
  const newDeptNames = Array.from(new Set(rows.map((r) => r.department))).filter((n) => !deptByName.has(resolveDept(n)));

  // ---- users ----
  const usernames = rows.map((r) => r.username);
  const existingUsers = await dataSource.getRepository(User).find({ where: { username: In(usernames) } });
  const existingSet = new Set(existingUsers.map((u) => u.username));
  const toCreate = rows.filter((r) => !existingSet.has(r.username));

  console.log(`\nDepartments to create (${newDeptNames.length}): ${newDeptNames.join(', ') || 'none'}`);
  console.log(`Users to create: ${toCreate.length}   Already exist (skipped): ${existingSet.size}`);
  if (existingSet.size) console.log(`  skipped: ${Array.from(existingSet).join(', ')}`);

  if (DRY_RUN) {
    await dataSource.destroy();
    console.log('\nDry run finished. Nothing was written.');
    return;
  }

  // ---- hash passwords (slow, so done before the transaction) ----
  const hashes = new Map<string, string>();
  let n = 0;
  for (const r of toCreate) {
    hashes.set(r.username, await bcrypt.hash(r.password, BCRYPT_ROUNDS));
    if (++n % 25 === 0) console.log(`  hashed ${n}/${toCreate.length}`);
  }

  // ---- write everything in one transaction ----
  let headsSet = 0;
  await dataSource.transaction(async (em) => {
    const deptRepo = em.getRepository(Department);
    const userRepo = em.getRepository(User);

    for (const name of newDeptNames) {
      const d = await deptRepo.save(deptRepo.create({ name }));
      deptByName.set(name, d);
    }

    const users = toCreate.map((r) => {
      const parts = r.name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ');
      const dept = deptByName.get(resolveDept(r.department))!;
      return userRepo.create({
        username: r.username,
        passwordHash: hashes.get(r.username)!,
        firstName,
        lastName,
        position: r.position,
        departmentId: dept.id,
        status: UserStatus.ACTIVE,
        language: Language.EN,
        mustChangePassword: true,
        roles: ROLES_BY_POSITION[r.position].map((rn) => roleByName.get(rn)!),
      });
    });
    await userRepo.save(users, { chunk: 50 });

    // department heads
    for (let i = 0; i < toCreate.length; i++) {
      if (toCreate[i].position !== 'Department Head') continue;
      const dept = deptByName.get(resolveDept(toCreate[i].department))!;
      if (dept.headDoctorId) continue;
      await deptRepo.update(dept.id, { headDoctorId: users[i].id });
      dept.headDoctorId = users[i].id;
      headsSet++;
    }
  });

  console.log(`\nCreated ${toCreate.length} users, ${newDeptNames.length} department(s); set ${headsSet} department head(s).`);
  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
