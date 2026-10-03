import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RolesService } from './roles.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get('roles')
  findAllRoles() {
    return this.rolesService.findAllRoles();
  }

  @Get('permissions')
  findAllPermissions() {
    return this.rolesService.findAllPermissions();
  }

  @Permissions('settings:update')
  @Post('roles')
  createRole(@Body() body: { name: string; displayName?: string; description?: string }) {
    return this.rolesService.createRole(body);
  }

  @Permissions('settings:update')
  @Patch('roles/:id')
  updateRole(
    @Param('id') id: string,
    @Body() body: { displayName?: string; description?: string; isActive?: boolean; permissionIds?: string[] },
  ) {
    return this.rolesService.updateRole(id, body);
  }

  @Permissions('settings:update')
  @Delete('roles/:id')
  removeRole(@Param('id') id: string) {
    return this.rolesService.removeRole(id);
  }
}
