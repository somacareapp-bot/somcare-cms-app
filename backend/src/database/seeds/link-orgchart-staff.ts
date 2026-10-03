/**
 * Somcare CMS - link org chart boxes to the seeded staff so headcounts are live.
 *
 *   npx ts-node src/database/seeds/link-orgchart-staff.ts --dry-run   (preview)
 *   npx ts-node src/database/seeds/link-orgchart-staff.ts             (apply)
 *   add --force to replace links that are already set
 *
 * Safe to re-run:
 *  - a box that already has a link is left alone (unless --force)
 *  - "Doctors" and "Reception Staff" boxes are created only if they don't exist
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';
import { OrgChartNode } from '../../org-chart/entities/org-chart-node.entity';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

interface LinkSpec {
  title: string;
  linkType: 'position' | 'role';
  linkValue: string;
  create?: { parentTitle: string; subtitle: string; department: string };
}

// position = exact text of the user's position; role = role name
const LINKS: LinkSpec[] = [
  { title: 'Department Heads', linkType: 'position', linkValue: 'Department Head' },
  { title: 'Specialist Physicians', linkType: 'position', linkValue: 'Specialist Physician' },
  { title: 'Nursing Staff', linkType: 'position', linkValue: 'Nurse' },
  { title: 'Pharmacists', linkType: 'role', linkValue: 'pharmacist' },
  { title: 'Laboratory Staff', linkType: 'role', linkValue: 'laboratory' },
  { title: 'Accountants', linkType: 'position', linkValue: 'Accountant' },
  {
    title: 'Doctors',
    linkType: 'position',
    linkValue: 'Doctor',
    create: { parentTitle: 'Medical Director', subtitle: 'General doctors', department: 'Clinical' },
  },
  {
    title: 'Reception Staff',
    linkType: 'position',
    linkValue: 'Reception Staff',
    create: { parentTitle: 'Chief Admin Officer', subtitle: 'Front desk and registration', department: 'Administration' },
  },
];

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

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
  console.log(`Connected to database${DRY_RUN ? '  (DRY RUN - nothing will be written)' : ''}\n`);

  const repo = dataSource.getRepository(OrgChartNode);
  const all = await repo.find();
  let nextOrder = Math.max(0, ...all.map((n) => n.order ?? 0)) + 1;

  for (const l of LINKS) {
    const matches = all.filter((n) => same(n.title, l.title));
    if (matches.length > 1) console.log(`! "${l.title}" exists ${matches.length} times - using the first one`);
    const node = matches[0];

    if (!node) {
      if (!l.create) {
        console.log(`- "${l.title}": box not found, skipped`);
        continue;
      }
      const parent = all.find((n) => same(n.title, l.create!.parentTitle));
      if (!parent) {
        console.log(`- "${l.title}": parent box "${l.create.parentTitle}" not found, skipped`);
        continue;
      }
      console.log(`+ "${l.title}": create under "${parent.title}", linked to ${l.linkType}: ${l.linkValue}`);
      if (!DRY_RUN) {
        const created = await repo.save(
          repo.create({
            title: l.title,
            subtitle: l.create.subtitle,
            department: l.create.department,
            headcount: 0,
            order: nextOrder++,
            parentId: parent.id,
            linkType: l.linkType,
            linkValue: l.linkValue,
          }),
        );
        all.push(created);
      }
      continue;
    }

    if (node.linkType && node.linkValue && !FORCE) {
      console.log(`= "${l.title}": already linked (${node.linkType}: ${node.linkValue}) - kept`);
      continue;
    }

    console.log(`~ "${l.title}": link -> ${l.linkType}: ${l.linkValue}`);
    if (!DRY_RUN) await repo.update(node.id, { linkType: l.linkType, linkValue: l.linkValue });
  }

  await dataSource.destroy();
  console.log(DRY_RUN ? '\nDry run finished. Nothing was written.' : '\nDone! Refresh the Org chart page.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
