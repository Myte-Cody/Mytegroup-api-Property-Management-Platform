import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { MongoIdValidationPipe } from '../../../common/pipes/mongo-id-validation.pipe';
import { AdminQueryDto } from '../dto/admin-query.dto';
import { AdminOnlyGuard } from '../guards/admin-only.guard';
import { AdminChatService } from '../services/admin-chat.service';

@ApiTags('Admin - Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('admin')
export class AdminChatController {
  constructor(private readonly adminChatService: AdminChatService) {}

  @Get('threads')
  @ApiOperation({ summary: 'Get all chat threads across all landlords (read-only)' })
  @ApiResponse({
    status: 200,
    description: 'Threads retrieved successfully',
  })
  async getThreads(@Query() queryDto: AdminQueryDto) {
    return this.adminChatService.findAllThreads(queryDto);
  }

  @Get('threads/:id')
  @ApiOperation({ summary: 'Get thread by ID with messages (read-only)' })
  @ApiParam({ name: 'id', description: 'Thread ID', type: String })
  @ApiResponse({
    status: 200,
    description: 'Thread retrieved successfully',
  })
  async getThreadById(@Param('id', MongoIdValidationPipe) id: string) {
    return this.adminChatService.findThreadById(id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'Get system-wide notifications' })
  @ApiResponse({
    status: 200,
    description: 'Notifications retrieved successfully',
  })
  async getNotifications(@Query() queryDto: AdminQueryDto) {
    return this.adminChatService.findAllNotifications(queryDto);
  }
}
