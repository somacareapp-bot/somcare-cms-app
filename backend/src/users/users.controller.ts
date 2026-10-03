import { Body, Controller, Delete, ForbiddenException, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
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
    return hideSalary(user, req.user);
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
  async create(@Body() body: any, @Req() req: any) {
    if (!has(req.user, 'salary:update')) {
      body = { ...body };
      delete body.salary;
    }
    const created = await this.usersService.create(body);
    return hideSalary(created, req.user);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: any, @Req() req: any) {
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
    const updated = await this.usersService.update(id, body);
    return hideSalary(updated, u);
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
