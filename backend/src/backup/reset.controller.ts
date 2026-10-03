import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ResetService, ResetMode } from './reset.service';
import { AdministratorOnlyGuard } from './administrator-only.guard';

@UseGuards(JwtAuthGuard, PermissionsGuard, AdministratorOnlyGuard)
@Controller('app-reset')
export class ResetController {
  constructor(private readonly service: ResetService) {}

  @Permissions('backup:manage')
  @Get('preview')
  preview(@Query('mode') mode: ResetMode) {
    return this.service.preview(mode);
  }

  @Permissions('backup:manage')
  @Post()
  run(@Body() body: { mode: ResetMode; confirmText: string }, @Req() req: any) {
    const userId = req.user?.id ?? req.user?.userId ?? req.user?.sub;
    return this.service.run(body?.mode, body?.confirmText, userId);
  }
}
