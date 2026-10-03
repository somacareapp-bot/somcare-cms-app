#!/usr/bin/env python3
"""
Fix: apply hideSalary() to every users.controller.ts endpoint that
returns a full user object, not just findAll/findDoctors.

Run from the project root (folder containing backend/):
    python3 fix-salary-leak.py
"""
import datetime, os, shutil, sys

ROOT = os.getcwd()
BE = os.path.join(ROOT, "backend", "src")
TS = datetime.datetime.now().strftime("%Y%m%d%H%M%S")

uc_path = os.path.join(BE, "users", "users.controller.ts")
if not os.path.isfile(uc_path):
    sys.exit(f"Not found: {uc_path} — run this from the project root.")

with open(uc_path, "r", encoding="utf-8") as f:
    s = f.read()

if "hideSalary(user, req.user)" in s:
    print("skip — already patched")
    sys.exit(0)

shutil.copy2(uc_path, f"{uc_path}.bak.{TS}")

# getMe: redact salary on self-view too, unless they hold salary:read
old = """  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    return user;
  }"""
new = """  @Get('me')
  async getMe(@Req() req: any) {
    const user = await this.usersService.findOne(req.user.id);
    return hideSalary(user, req.user);
  }"""
assert old in s, "getMe() block not found — check manually"
s = s.replace(old, new)

# create: redact salary in the response (write-side already strips it from body)
old = """  @Permissions('staff:create')
  @Post()
  create(@Body() body: any, @Req() req: any) {
    if (!has(req.user, 'salary:update')) {
      body = { ...body };
      delete body.salary;
    }
    return this.usersService.create(body);
  }"""
new = """  @Permissions('staff:create')
  @Post()
  async create(@Body() body: any, @Req() req: any) {
    if (!has(req.user, 'salary:update')) {
      body = { ...body };
      delete body.salary;
    }
    const created = await this.usersService.create(body);
    return hideSalary(created, req.user);
  }"""
assert old in s, "create() block not found — check manually"
s = s.replace(old, new)

# update: this is the one that leaked in testing
old = """  @Patch(':id')
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
  }"""
new = """  @Patch(':id')
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
  }"""
assert old in s, "update() block not found — check manually"
s = s.replace(old, new)

with open(uc_path, "w", encoding="utf-8") as f:
    f.write(s)

print("patched", os.path.relpath(uc_path, ROOT))
print("backup :", os.path.relpath(f"{uc_path}.bak.{TS}", ROOT))
