import { Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
// import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // wire up to your existing auth guard

@Controller('notifications')
// @UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  findMine(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const userId = req.user?.id ?? req.query.userId; // TODO: read from your auth context
    return this.service.findForUser(userId, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
      unreadOnly: unreadOnly === 'true',
    });
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    const userId = req.user?.id ?? req.query.userId;
    return this.service.getUnreadCount(userId);
  }

  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id ?? req.query.userId;
    return this.service.markRead(userId, id);
  }

  @Patch('read-all')
  markAllRead(@Req() req: any) {
    const userId = req.user?.id ?? req.query.userId;
    return this.service.markAllRead(userId);
  }
}
