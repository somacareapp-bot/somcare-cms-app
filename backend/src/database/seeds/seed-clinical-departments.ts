import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const DEPARTMENT_NAMES = [
  'Internal Medicine',
  'General Surgery',
  'Pediatrics',
  'Obstetrics & Gynecology',
  'Emergency Department',
  'Intensive Care Unit (ICU)',
  'Anesthesia',
  'Cardiology',
  'Neurology',
  'Neurosurgery',
  'Orthopedics',
  'Urology',
  'Nephrology',
  'Gastroenterology',
  'Pulmonology',
  'Endocrinology',
  'Dermatology',
  'Psychiatry & Mental Health',
  'Oncology',
  'Infectious Diseases',
  'Ophthalmology',
  'ENT (Ear, Nose & Throat)',
  'Dental & Oral Health',
  'Family Medicine',
  'Outpatient Department (OPD)',
  'Inpatient Department (IPD)',
];

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

  const departmentsRepo = dataSource.getRepository(Department);

  const existing = await departmentsRepo.find({ where: DEPARTMENT_NAMES.map((name) => ({ name })) });
  const existingNames = new Set(existing.map((d) => d.name));

  const toCreate = DEPARTMENT_NAMES.filter((name) => !existingNames.has(name));

  if (toCreate.length === 0) {
    console.log('All clinical departments already exist. Nothing to add.');
  } else {
    const newDepartments = toCreate.map((name) => departmentsRepo.create({ name }));
    await departmentsRepo.save(newDepartments);
    console.log(`Added ${newDepartments.length} department(s):`);
    newDepartments.forEach((d) => console.log(`  + ${d.name}`));
  }

  if (existingNames.size > 0) {
    console.log(`\nSkipped ${existingNames.size} already-existing department(s):`);
    existingNames.forEach((name) => console.log(`  = ${name}`));
  }

  const total = await departmentsRepo.count();
  console.log(`\nDepartments table now has ${total} total row(s).`);

  await dataSource.destroy();
  console.log('Done!');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
