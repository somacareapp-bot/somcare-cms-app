import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { User, UserStatus, Language } from '../../users/entities/user.entity';

export async function runInitialSeed(dataSource: DataSource) {
  const permissionRepo = dataSource.getRepository(Permission);
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);

  const existingPerm = await permissionRepo.findOne({ where: { name: 'patients:read' } });
  if (existingPerm) {
    console.log('skipped initial seed (permissions already exist)');
    return;
  }

  // 1. Create permissions
  const modules = [
    'patients', 'appointments', 'visits', 'queue', 'triage',
    'consultations', 'diagnoses', 'prescriptions', 'pharmacy',
    'laboratory', 'radiology', 'billing', 'payments', 'inventory',
    'staff', 'reports', 'settings', 'users', 'roles', 'audit',
  ];
  const actions = ['read', 'create', 'update', 'delete', 'export'];

  const permissions: Permission[] = [];
  for (const mod of modules) {
    for (const action of actions) {
      const perm = permissionRepo.create({
        name: `${mod}:${action}`,
        module: mod,
        action,
        description: `Can ${action} ${mod}`,
      });
      permissions.push(perm);
    }
  }
  await permissionRepo.save(permissions);
  console.log(`✅ Created ${permissions.length} permissions`);

  // 2. Create roles
  const allPerms = await permissionRepo.find();
  const getPerms = (...mods: string[]) =>
    allPerms.filter((p) => mods.includes(p.module));

  const rolesData = [
    {
      name: 'administrator',
      displayName: 'Administrator',
      permissions: allPerms, // full access
    },
    {
      name: 'receptionist',
      displayName: 'Receptionist',
      permissions: getPerms('patients', 'appointments', 'visits', 'queue', 'billing'),
    },
    {
      name: 'nurse',
      displayName: 'Nurse',
      permissions: getPerms('patients', 'triage', 'queue', 'visits'),
    },
    {
      name: 'doctor',
      displayName: 'Doctor',
      // Doctors can order tests and view results, but not collect samples or enter results — that's the Laboratory Technician role's job.
      permissions: [
        ...getPerms('patients', 'consultations', 'diagnoses', 'prescriptions', 'radiology', 'visits', 'triage'),
        ...allPerms.filter((p) => p.module === 'laboratory' && ['read', 'create'].includes(p.action)),
      ],
    },
    {
      name: 'pharmacist',
      displayName: 'Pharmacist',
      permissions: getPerms('prescriptions', 'pharmacy', 'inventory'),
    },
    {
      name: 'laboratory',
      displayName: 'Laboratory Technician',
      permissions: getPerms('laboratory', 'patients'),
    },
    {
      name: 'radiologist',
      displayName: 'Radiologist',
      permissions: getPerms('radiology', 'patients'),
    },
    {
      name: 'accountant',
      displayName: 'Accountant',
      permissions: getPerms('billing', 'payments', 'reports', 'inventory', 'pharmacy'),
    },
    {
      name: 'storekeeper',
      displayName: 'Storekeeper',
      permissions: getPerms('inventory'),
    },
  ];

  const createdRoles: Role[] = [];
  for (const rd of rolesData) {
    const role = roleRepo.create(rd);
    createdRoles.push(await roleRepo.save(role));
  }
  console.log(`✅ Created ${createdRoles.length} roles`);

  // 3. Create default admin user
  const adminRole = createdRoles.find((r) => r.name === 'administrator')!
  const passwordHash = await bcrypt.hash('Admin@1234', 12);

  const admin = userRepo.create({
    username: 'admin',
    passwordHash,
    firstName: 'System',
    lastName: 'Administrator',
    email: 'admin@clinic.local',
    status: UserStatus.ACTIVE,
    language: Language.EN,
    mustChangePassword: true, // Force password change on first login
    roles: [adminRole],
  });
  await userRepo.save(admin);
  console.log('✅ Created default admin user (username: admin, password: Admin@1234)');
  console.log('⚠️  Please change the default password immediately after first login!');
}
