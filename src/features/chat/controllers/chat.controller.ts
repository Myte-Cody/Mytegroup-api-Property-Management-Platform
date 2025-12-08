import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiConsumes } from '@nestjs/swagger';
import { FormDataRequest } from 'nestjs-form-data';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { User } from '../../users/schemas/user.schema';
import { AddGroupMembersDto } from '../dto/add-group-members.dto';
import { CreateChatSessionDto } from '../dto/create-chat-session.dto';
import { CreateGroupChatDto } from '../dto/create-group-chat.dto';
import { MuteThreadDto } from '../dto/mute-thread.dto';
import { SendMessageDto } from '../dto/send-message.dto';
import { TransferOwnershipDto } from '../dto/transfer-ownership.dto';
import { UpdateGroupAvatarDto } from '../dto/update-group-avatar.dto';
import { UpdateGroupNameDto } from '../dto/update-group-name.dto';
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
      createGroupChatDto.avatarUrl,
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

  /**
   * Leave a group chat
   */
  @Post('groups/:threadId/leave')
  async leaveGroup(@CurrentUser() user: User, @Param('threadId') threadId: string) {
    const userId = user._id.toString();

    await this.chatService.leaveGroup(threadId, userId);

    return {
      success: true,
      message: 'Left group successfully',
    };
  }

  /**
   * Update group name
   */
  @Put('groups/:threadId/name')
  async updateGroupName(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() updateGroupNameDto: UpdateGroupNameDto,
  ) {
    const currentUserId = user._id.toString();

    await this.chatService.updateGroupName(threadId, currentUserId, updateGroupNameDto.name);

    return {
      success: true,
      message: 'Group name updated successfully',
    };
  }

  /**
   * Update group avatar
   */
  @Put('groups/:threadId/avatar')
  @FormDataRequest()
  @ApiConsumes('multipart/form-data')
  async updateGroupAvatar(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() updateGroupAvatarDto: UpdateGroupAvatarDto,
  ) {
    const currentUserId = user._id.toString();

    await this.chatService.updateGroupAvatar(
      threadId,
      currentUserId,
      updateGroupAvatarDto.avatar,
      user,
    );

    return {
      success: true,
      message: 'Group avatar updated successfully',
    };
  }

  /**
   * Transfer group ownership
   */
  @Put('groups/:threadId/ownership')
  async transferOwnership(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() transferOwnershipDto: TransferOwnershipDto,
  ) {
    const currentUserId = user._id.toString();

    await this.chatService.transferOwnership(
      threadId,
      currentUserId,
      transferOwnershipDto.newOwnerId,
    );

    return {
      success: true,
      message: 'Ownership transferred successfully',
    };
  }

  /**
   * Block a user
   */
  @Post('block/:userId')
  async blockUser(@CurrentUser() user: User, @Param('userId') userId: string) {
    const currentUserId = user._id.toString();

    await this.chatService.blockUser(currentUserId, userId, user);

    return {
      success: true,
      message: 'User blocked successfully',
    };
  }

  /**
   * Unblock a user
   */
  @Delete('block/:userId')
  async unblockUser(@CurrentUser() user: User, @Param('userId') userId: string) {
    const currentUserId = user._id.toString();

    await this.chatService.unblockUser(currentUserId, userId);

    return {
      success: true,
      message: 'User unblocked successfully',
    };
  }

  /**
   * Get list of blocked users (users you blocked and users who blocked you)
   */
  @Get('blocked-users')
  async getBlockedUsers(@CurrentUser() user: User) {
    const currentUserId = user._id.toString();

    const result = await this.chatService.getBlockedUsers(currentUserId);

    return {
      success: true,
      ...result,
    };
  }

  /**
   * Mute a thread (conversation or group)
   */
  @Post('sessions/:threadId/mute')
  async muteThread(
    @CurrentUser() user: User,
    @Param('threadId') threadId: string,
    @Body() muteThreadDto: MuteThreadDto,
  ) {
    const currentUserId = user._id.toString();

    await this.chatService.muteThread(currentUserId, threadId, muteThreadDto.muteUntil);

    return {
      success: true,
      message: muteThreadDto.muteUntil ? 'Thread muted temporarily' : 'Thread muted permanently',
    };
  }

  /**
   * Unmute a thread
   */
  @Delete('sessions/:threadId/mute')
  async unmuteThread(@CurrentUser() user: User, @Param('threadId') threadId: string) {
    const currentUserId = user._id.toString();

    await this.chatService.unmuteThread(currentUserId, threadId);

    return {
      success: true,
      message: 'Thread unmuted successfully',
    };
  }

  /**
   * Clear chat history for a thread (local only - marks as deleted for user)
   */
  @Delete('sessions/:threadId/history')
  async clearChatHistory(@CurrentUser() user: User, @Param('threadId') threadId: string) {
    const currentUserId = user._id.toString();

    await this.chatService.clearChatHistory(currentUserId, threadId);

    return {
      success: true,
      message: 'Chat history cleared successfully',
    };
  }
}
