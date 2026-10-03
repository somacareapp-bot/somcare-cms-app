#!/usr/bin/env python3
"""
Somcare CMS - permissions for Salary and Org chart, and lock down the Users API.

Run from the project root (folder containing backend/ and frontend/):
    python3 permissions_salary_orgchart.py

What it does
  BACKEND
   1. Writes backend/src/database/seeds/add-salary-orgchart-permissions.ts
      (creates salary:read, salary:update, orgchart:read/create/update/delete;
       administrator gets all of them, every other role gets orgchart:read)
   2. users.controller.ts: was open to ANY logged-in user (list, create, edit,
      delete, salaries). Now: staff:create / staff:update / staff:delete are
      enforced, salary is hidden unless salary:read, salary is only writable with
      salary:update, and a user can still edit their OWN language/theme/phone/email
      and photo. me / roles / doctors stay open to logged-in users.
   3. org-chart.controller.ts: orgchart:read / create / update / delete enforced
  FRONTEND
   4. OrgChartPage.tsx: Add / Edit / Delete buttons follow orgchart:create /
      update / delete instead of the administrator-or-manager role check
   5. App.tsx route and Sidebar item: gated by orgchart:read

Backs up every file it changes as <file>.bak.<timestamp>. Safe to re-run.
After it finishes it prints the one command that creates the permissions.
"""
import datetime
import os
import shutil
import sys

ROOT = os.getcwd()
BE = os.path.join(ROOT, "backend", "src")
FE = os.path.join(ROOT, "frontend", "src")
TS = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

for d in (BE, FE):
    if not os.path.isdir(d):
        sys.exit("Run this from the project root (folder containing backend/ and frontend/).")


def read(p):
    with open(p, "r", encoding="utf-8") as f:
        return f.read()


def write(p, t):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(t)


def backup(p):
    shutil.copy2(p, f"{p}.bak.{TS}")


def rel(p):
    return os.path.relpath(p, ROOT)


# =============================================================== 1. seed script
SEED_TS = r"""/**
 * Somcare CMS - add Salary and Org chart permissions.
 *
 * Run from the backend folder:
 *   npx ts-node src/database/seeds/add-salary-orgchart-permissions.ts
 *
 * Safe to re-run. Only ADDS: creates missing permissions and grants them.
 *  - administrator gets every permission listed here
 *  - every other role gets orgchart:read (view the chart). Untick it in Settings
 *    for any role that should not see the org chart.
 *  - salary:* is granted to nobody but administrator; tick it per role in Settings.
 */
import { DataSource, In } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

import { User } from '../../users/entities/user.entity';
import { Role } from '../../users/entities/role.entity';
import { Permission } from '../../users/entities/permission.entity';
import { AuditLog } from '../../audit/entities/audit-log.entity';
import { Patient } from '../../patients/entities/patient.entity';
import { Department } from '../../departments/entities/department.entity';

const NEW_PERMISSIONS = [
  'salary:read',
  'salary:update',
  'orgchart:read',
  'orgchart:create',
  'orgchart:update',
  'orgchart:delete',
];
const READ_FOR_EVERY_ROLE = 'orgchart:read';

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

  // 1. create missing permissions
  const existing = await permRepo.find({ where: { name: In(NEW_PERMISSIONS) } });
  for (const name of NEW_PERMISSIONS) {
    if (existing.some((p) => p.name === name)) continue;
    const [module, action] = name.split(':');
    await permRepo.save(permRepo.create({ name, module, action, description: `${action} ${module}` } as any));
    console.log(`created permission ${name}`);
  }
  const perms = await permRepo.find({ where: { name: In(NEW_PERMISSIONS) } });
  const byName = new Map(perms.map((p) => [p.name, p]));

  // 2. grant
  const roles = await roleRepo.find({ relations: ['permissions'] });
  for (const role of roles) {
    const wanted =
      role.name === 'administrator'
        ? NEW_PERMISSIONS
        : [READ_FOR_EVERY_ROLE];
    const have = new Set((role.permissions ?? []).map((p) => p.name));
    const toAdd = wanted.filter((n) => !have.has(n)).map((n) => byName.get(n)).filter(Boolean) as Permission[];
    if (!toAdd.length) {
      console.log(`${role.name}: nothing to add`);
      continue;
    }
    role.permissions = [...(role.permissions ?? []), ...toAdd];
    await roleRepo.save(role);
    console.log(`${role.name}: + ${toAdd.map((p) => p.name).join(', ')}`);
  }

  await dataSource.destroy();
  console.log('\nDone! Users must log out and back in to pick up new permissions.');
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
"""
seed_path = os.path.join(BE, "database", "seeds", "add-salary-orgchart-permissions.ts")
write(seed_path, SEED_TS)
print("wrote    ", rel(seed_path))

# ======================================================= 2. users.controller.ts
USERS_CTRL = r"""import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { UsersService } from './users.service';
import { ResetPasswordDto } from './dto/reset-password.dto';

const isAdmin = (u: any) => !!u?.roles?.includes('administrator');
const has = (u: any, p: string) => isAdmin(u) || !!u?.permissions?.includes(p);

// Fields any logged-in user may change on their OWN record without staff:update
const SELF_EDITABLE = ['language', 'theme', 'phone', 'email'];

// Blanks salary in place (keeps the entity instance so @Exclude on passwordHash still applies)
function hideSalary(rows: any, u: any) {
  if (has(u, 'salary:read')) return rows;
  const list = Array.isArray(rows) ? rows : [rows];
  list.forEach((r: any) => {
    if (r) r.salary = null;
  });
  return rows;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    return user;
  }

  @Get('roles')
  findAllRoles() {
    return this.usersService.findAllRoles();
  }

  @Get('doctors')
  async findDoctors(@Req() req: any, @Query('departmentId') departmentId?: string) {
    const doctors = await this.usersService.findDoctors(departmentId);
    return hideSalary(doctors, req.user);
  }

  @Get()
  async findAll(@Req() req: any) {
    const users = await this.usersService.findAll();
    return hideSalary(users, req.user);
  }

  @Permissions('staff:create')
  @Post()
  create(@Body() body: any, @Req() req: any) {
    if (!has(req.user, 'salary:update')) {
      body = { ...body };
      delete body.salary;
    }
    return this.usersService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
    const u = req.user;
    if (!has(u, 'staff:update')) {
      // not staff-admin: only your own record, and only harmless fields
      if (u?.id !== id) throw new ForbiddenException('You do not have permission to edit staff');
      const safe: any = {};
      for (const k of SELF_EDITABLE) {
        if (body && k in body) safe[k] = body[k];
      }
      body = safe;
    }
    if (!has(u, 'salary:update')) {
      body = { ...body };
      delete body.salary;
    }
    return this.usersService.update(id, body);
  }

  @Permissions('staff:delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }

  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dir = path.join(process.cwd(), '..', 'uploads', 'staff');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `staff-${req.params.id}-${Date.now()}${ext}`);
      },
    }),
    fileFilter: (req, file, cb) => {
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, allowed.includes(ext));
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadPhoto(@Param('id') id: string, @UploadedFile() file: Express.Multer.File, @Req() req: any) {
    if (!has(req.user, 'staff:update') && req.user?.id !== id) {
      throw new ForbiddenException('You do not have permission to edit staff');
    }
    if (!file) throw new Error('No valid image file received');
    const photoUrl = `/uploads/staff/${file.filename}`;
    await this.usersService.update(id, { profilePhoto: photoUrl } as any);
    return { photoUrl };
  }

  // Admin-only. Generates (or accepts) a new password for the target user,
  // hashes it, and forces a change on next login. The plaintext password is
  // returned once in this response only - hand it to the user out of band.
  @Patch(':id/reset-password')
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @Req() req: any) {
    const roles: string[] = req.user?.roles ?? [];
    if (!roles.includes('administrator')) {
      throw new ForbiddenException('Only administrators can reset passwords');
    }
    return this.usersService.resetPassword(id, dto.newPassword);
  }
}
"""
uc_path = os.path.join(BE, "users", "users.controller.ts")
if not os.path.exists(uc_path):
    print("WARNING  users.controller.ts not found, skipped")
else:
    cur = read(uc_path)
    if "hideSalary" in cur:
        print("skip     users.controller.ts (already patched)")
    else:
        backup(uc_path)
        write(uc_path, USERS_CTRL)
        print("rewrote  ", rel(uc_path))

# ==================================================== 3. org-chart.controller.ts
ORG_CTRL = r"""import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { OrgChartService } from './org-chart.service';
import { CreateOrgChartNodeDto, UpdateOrgChartNodeDto } from './dto/org-chart.dto';

@ApiTags('Org Chart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('org-chart')
export class OrgChartController {
  constructor(private readonly service: OrgChartService) {}

  @Permissions('orgchart:read')
  @Get('tree')
  @ApiOperation({ summary: 'Get full hierarchy as nested tree' })
  getTree() { return this.service.getTree(); }

  @Permissions('orgchart:read')
  @Get()
  @ApiOperation({ summary: 'Get all nodes flat' })
  findAll() { return this.service.findAll(); }

  @Permissions('orgchart:read')
  @Get(':id')
  @ApiOperation({ summary: 'Get single node' })
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.service.findOne(id); }

  @Permissions('orgchart:create')
  @Post()
  @ApiOperation({ summary: 'Create node' })
  create(@Body() dto: CreateOrgChartNodeDto) { return this.service.create(dto); }

  @Permissions('orgchart:update')
  @Patch(':id')
  @ApiOperation({ summary: 'Update node' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOrgChartNodeDto) { return this.service.update(id, dto); }

  @Permissions('orgchart:delete')
  @Delete(':id')
  @ApiOperation({ summary: 'Delete node' })
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
"""
oc_path = os.path.join(BE, "org-chart", "org-chart.controller.ts")
if not os.path.exists(oc_path):
    print("WARNING  org-chart.controller.ts not found, skipped")
else:
    cur = read(oc_path)
    if "PermissionsGuard" in cur:
        print("skip     org-chart.controller.ts (already patched)")
    else:
        backup(oc_path)
        write(oc_path, ORG_CTRL)
        print("rewrote  ", rel(oc_path))

# ============================================================= 4. OrgChartPage
page_path = os.path.join(FE, "modules", "org-chart", "OrgChartPage.tsx")
if not os.path.exists(page_path):
    print("WARNING  OrgChartPage.tsx not found, skipped")
else:
    page = read(page_path)
    if "orgchart:update" in page:
        print("skip     OrgChartPage.tsx (already patched)")
    else:
        backup(page_path)
        ok = True

        def sub(text, old, new, label):
            global ok
            if old not in text:
                print(f"WARNING  OrgChartPage.tsx: could not find {label}")
                ok = False
                return text
            return text.replace(old, new, 1)

        page = sub(
            page,
            "const { hasRole } = useAuthStore();\n  const canEdit = hasRole('administrator') || hasRole('manager');",
            "const { hasPermission } = useAuthStore();\n"
            "  const canCreate = hasPermission('orgchart:create');\n"
            "  const canUpdate = hasPermission('orgchart:update');\n"
            "  const canDelete = hasPermission('orgchart:delete');\n"
            "  const canEdit = canCreate; // header 'Add role' and the '+' add-child button",
            "role check",
        )
        page = sub(
            page,
            '{canEdit && (\n            <div className="mt-3 flex gap-2">',
            '{(canUpdate || canDelete) && (\n            <div className="mt-3 flex gap-2">',
            "detail panel buttons wrapper",
        )
        page = sub(
            page,
            "onClick={() => openEdit(selected)}",
            "onClick={() => openEdit(selected)}\n                disabled={!canUpdate}",
            "edit button",
        )
        page = sub(
            page,
            'className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 py-1.5 text-xs text-gray-700 hover:bg-gray-50"',
            'className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-gray-300 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"',
            "edit button style",
        )
        page = sub(
            page,
            "disabled={deleteMut.isPending}",
            "disabled={deleteMut.isPending || !canDelete}",
            "delete button",
        )
        write(page_path, page)
        print("patched  ", rel(page_path), "" if ok else "(with warnings above)")

# ================================================= 5. App.tsx route + Sidebar item
app_path = os.path.join(FE, "App.tsx")
if os.path.exists(app_path):
    lines = read(app_path).split("\n")
    changed = False
    for i, l in enumerate(lines):
        if 'path="org-chart"' in l and 'permission="staff:read"' in l:
            lines[i] = l.replace('permission="staff:read"', 'permission="orgchart:read"')
            changed = True
    if changed:
        backup(app_path)
        write(app_path, "\n".join(lines))
        print("patched  ", rel(app_path))
    else:
        print("skip     App.tsx (org-chart route not on staff:read; already patched or missing)")

sb_path = os.path.join(FE, "components", "layout", "Sidebar.tsx")
if os.path.exists(sb_path):
    lines = read(sb_path).split("\n")
    changed = False
    for i, l in enumerate(lines):
        if "path: '/org-chart'" in l and "'staff:read'" in l:
            lines[i] = l.replace("'staff:read'", "'orgchart:read'")
            changed = True
    if changed:
        backup(sb_path)
        write(sb_path, "\n".join(lines))
        print("patched  ", rel(sb_path))
    else:
        print("skip     Sidebar.tsx (org-chart item not on staff:read; already patched or missing)")

print("\nNEXT - create the permissions (run from the backend folder):")
print("  cd backend && npx ts-node src/database/seeds/add-salary-orgchart-permissions.ts")
print("Then log out and back in. Until the seed runs, non-administrators cannot open the org chart.")
