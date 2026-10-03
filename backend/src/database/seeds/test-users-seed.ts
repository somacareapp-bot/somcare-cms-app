import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../../users/entities/role.entity';
import { User, UserStatus, Language } from '../../users/entities/user.entity';

interface TestUser {
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  roleName: string;
}

const TEST_USERS: TestUser[] = [
  { username: 'dr.hassan', password: process.env.SEED_PASSWORD || 'ChangeMe-OnFirstLogin', firstName: 'Ahmed', lastName: 'Hassan', roleName: 'doctor' },
  { username: 'reception1', password: process.env.SEED_PASSWORD || 'ChangeMe-OnFirstLogin', firstName: 'Amina', lastName: 'Jama', roleName: 'receptionist' },
];

export async function runTestUsersSeed(dataSource: DataSource) {
  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);

  for (const tu of TEST_USERS) {
    const existing = await userRepo.findOne({ where: { username: tu.username } });
    if (existing) {
      console.log(`skipped ${tu.username} (already exists)`);
      continue;
    }

    const role = await roleRepo.findOne({ where: { name: tu.roleName } });
    if (!role) {
      console.log(`role "${tu.roleName}" not found - skipping ${tu.username}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(tu.password, 12);
    const user = userRepo.create({
      username: tu.username,
      passwordHash,
      firstName: tu.firstName,
      lastName: tu.lastName,
      status: UserStatus.ACTIVE,
      language: Language.EN,
      mustChangePassword: false,
      roles: [role],
    });
    await userRepo.save(user);
    console.log(`created ${tu.username} / ${tu.password} (${tu.roleName})`);
  }
}
