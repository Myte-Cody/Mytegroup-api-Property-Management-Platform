import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { ChatService } from '../services/chat.service';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  /**
   * Get all chat sessions for current user
   */
  @Get('sessions')
  async getChatSessions(@CurrentUser() user: User) {
    const userId = user._id.toString();
    return this.chatService.getChatSessions(userId);
  }

  /**
   * Create or get existing chat session with another user
   */
  @Post('sessions')
  async createChatSession(
    @CurrentUser() user: User,
    @Body() createChatSessionDto: CreateChatSessionDto,
  ) {
    const currentUserId = user._id.toString();

    return this.chatService.createOrGetChatSession(currentUserId, createChatSessionDto.userId);
  }

  /**
   * Get messages for a specific chat thread
   */
  @Get('sessions/:threadId/messages')
  async getChatMessages(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const userId = user._id.toString();
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 50;

    return this.chatService.getChatMessages(threadId, userId, pageNum, limitNum);
  }

  /**
   * Send a message in a chat thread
   */
  @Post('sessions/:threadId/messages')
  async sendMessage(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    const userId = user._id.toString();

    return this.chatService.sendMessage(
      threadId,
      userId,
      sendMessageDto.message,
      sendMessageDto.attachments,
    );
  }

  /**
   * Mark messages as read in a chat thread
   */
  @Put('sessions/:threadId/read')
  async markAsRead(@CurrentUser() user: User, @Param('threadId') threadId: string) {
    const userId = user._id.toString();

    await this.chatService.markAsRead(threadId, userId);
    return { success: true };
  }
}
