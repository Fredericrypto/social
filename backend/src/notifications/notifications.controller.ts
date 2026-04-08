import { Controller, Get, Patch, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  getAll(@Request() req, @Query('page') page = 1) {
    return this.notificationsService.getAll(req.user.id, +page);
  }

  @Get('unread-count')
  unreadCount(@Request() req) {
    return this.notificationsService.unreadCount(req.user.id);
  }

  @Patch('read-all')
  markAllRead(@Request() req) {
    return this.notificationsService.markAllRead(req.user.id);
  }

  @Patch(':id/read')
  markRead(@Request() req, @Param('id') id: string) {
    return this.notificationsService.markRead(id, req.user.id);
  }
}
