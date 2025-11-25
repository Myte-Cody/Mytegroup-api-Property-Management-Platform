import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';
import { AddGroupMembersDto } from '../dto/add-group-members.dto';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { CreateGroupChatDto } from '../dto/create-group-chat.dto';
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
   * Send a message in a chat thread (with optional media)
   */
  @Post('sessions/:threadId/messages')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
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
      sendMessageDto.media,
      user,
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

  /**
   * Create a group chat with multiple participants
   */
  @Post('groups')
  async createGroupChat(@CurrentUser() user: User, @Body() createGroupChatDto: CreateGroupChatDto) {
    const currentUserId = user._id.toString();

    const thread = await this.chatService.createGroupChat(
      currentUserId,
      createGroupChatDto.title,
      createGroupChatDto.participantIds,
    );

    return {
      success: true,
      threadId: thread._id,
      thread,
    };
  }

  /**
   * Add members to a group chat
   */
  @Post('groups/:threadId/members')
  async addGroupMembers(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() addGroupMembersDto: AddGroupMembersDto,
  ) {
    const currentUserId = user._id.toString();

    await this.chatService.addGroupMembers(threadId, currentUserId, addGroupMembersDto.userIds);

    return {
      success: true,
      message: 'Members added successfully',
    };
  }

  /**
   * Remove a member from a group chat
   */
  @Delete('groups/:threadId/members/:userId')
  async removeGroupMember(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Param('userId') userId: string,
  ) {
    const currentUserId = user._id.toString();

    await this.chatService.removeGroupMember(threadId, currentUserId, userId);

    return {
      success: true,
      message: 'Member removed successfully',
    };
  }
}
