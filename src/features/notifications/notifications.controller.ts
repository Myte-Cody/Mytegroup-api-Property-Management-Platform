import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth('JWT-auth')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get user notifications with pagination' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  async getUserNotifications(
    @Request() req,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const userId = req.user._id;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;
    const parsedUnreadOnly = unreadOnly === 'true';

    return this.notificationsService.getUserNotifications(
      userId,
      parsedLimit,
      parsedOffset,
      parsedUnreadOnly,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notifications count' })
  async getUnreadCount(@Request() req) {
    const userId = req.user._id;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark notification as read' })
  async markAsRead(@Request() req, @Param('id') notificationId: string) {
    const userId = req.user._id;
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllAsRead(@Request() req) {
    const userId = req.user._id;
    return this.notificationsService.markAllAsRead(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a notification' })
  async deleteNotification(@Request() req, @Param('id') notificationId: string) {
    const userId = req.user._id;
    await this.notificationsService.deleteNotification(notificationId, userId);
    return { message: 'Notification deleted successfully' };
  }

  @Post('test')
  @ApiOperation({ summary: 'Create a test notification (for development)' })
  async createTestNotification(
    @Request() req,
    @Body() body: { title: string; content: string; actionUrl?: string },
  ) {
    const userId = req.user._id;
    return this.notificationsService.createNotification(
      userId,
      body.title,
      body.content,
      body.actionUrl,
    );
  }
}
