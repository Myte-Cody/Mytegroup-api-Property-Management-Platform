import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemoryStoredFile } from 'nestjs-form-data';
import { Lease } from '../../leases/schemas/lease.schema';
import {
  MessageSenderType,
  SystemMessageType,
  ThreadMessage,
  ThreadMessageDocument,
} from '../../maintenance/schemas/thread-message.schema';
import {
  ParticipantStatus,
  ParticipantType,
  ThreadParticipant,
  ThreadParticipantDocument,
} from '../../maintenance/schemas/thread-participant.schema';
import {
  Thread,
  ThreadDocument,
  ThreadLinkedEntityType,
  ThreadType,
} from '../../maintenance/schemas/thread.schema';
import { MediaService } from '../../media/services/media.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Property } from '../../properties/schemas/property.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { ChatGateway } from '../chat.gateway';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Thread.name)
    private threadModel: Model<ThreadDocument>,
    @InjectModel(ThreadMessage.name)
    private threadMessageModel: Model<ThreadMessageDocument>,
    @InjectModel(ThreadParticipant.name)
    private threadParticipantModel: Model<ThreadParticipantDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Tenant.name)
    private tenantModel: Model<Tenant>,
    @InjectModel(Lease.name)
    private leaseModel: Model<Lease>,
    @InjectModel(Property.name)
    private propertyModel: Model<Property>,
    private notificationsService: NotificationsService,
    private chatGateway: ChatGateway,
    private mediaService: MediaService,
  ) {}

  /**
   * Create or get existing chat session between two users
   */
  async createOrGetChatSession(
    currentUserId: string,
    otherUserId: string,
  ): Promise<ThreadDocument> {
    // Validate other user exists
    const otherUser = await this.userModel.findById(otherUserId);

    if (!otherUser) {
      throw new NotFoundException('Other user not found');
    }

    if (currentUserId === otherUserId) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    // Check privacy settings - if the other user doesn't allow neighbors to message them
    if (!otherUser.allowNeighborsToMessage) {
      throw new ForbiddenException('This user has disabled direct messages from neighbors');
    }

    // Check if chat already exists between these two users
    const existingThread = await this.findExistingChat(currentUserId, otherUserId);

    if (existingThread) {
      return existingThread;
    }

    // Create new chat thread
    const sortedUserIds = [currentUserId, otherUserId].sort();
    const linkedEntityId = sortedUserIds[0];

    const thread = new this.threadModel({
      title: `Chat between users`,
      linkedEntityType: ThreadLinkedEntityType.TENANT_CHAT,
      linkedEntityId: new Types.ObjectId(linkedEntityId),
      linkedEntityModel: 'User',
      threadType: ThreadType.TENANT_TENANT,
    });

    const savedThread = await thread.save();

    // Create participants for both users
    const participants = [
      {
        thread: savedThread._id,
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(currentUserId),
        participantModel: 'User',
        status: ParticipantStatus.ACCEPTED,
      },
      {
        thread: savedThread._id,
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(otherUserId),
        participantModel: 'User',
        status: ParticipantStatus.ACCEPTED,
      },
    ];

    await this.threadParticipantModel.insertMany(participants);

    return savedThread;
  }

  /**
   * Find existing chat between two users
   */
  private async findExistingChat(userId1: string, userId2: string): Promise<ThreadDocument | null> {
    const sortedIds = [userId1, userId2].sort();

    // Try to find a thread where both users are participants
    const threads = await this.threadModel.find({
      linkedEntityType: ThreadLinkedEntityType.TENANT_CHAT,
      threadType: ThreadType.TENANT_TENANT,
    });

    for (const thread of threads) {
      const participants = await this.threadParticipantModel.find({ thread: thread._id });

      const userIds = participants
        .map((p) => p.participantId?.toString())
        .filter(Boolean)
        .sort();

      if (userIds.length === 2 && userIds[0] === sortedIds[0] && userIds[1] === sortedIds[1]) {
        return thread;
      }
    }

    return null;
  }

  /**
   * Get all chat sessions for a user (includes both tenant-to-tenant chats and lease chats)
   */
  async getChatSessions(userId: string): Promise<any[]> {
    // Find all participants records for this user (regardless of participant type)
    const participantRecords = await this.threadParticipantModel
      .find({
        participantId: new Types.ObjectId(userId),
      })
      .populate('thread');

    // Filter for TENANT_CHAT and LEASE threads
    const chatThreadIds = participantRecords
      .filter(
        (p) =>
          p.thread &&
          ((p.thread as any).linkedEntityType === ThreadLinkedEntityType.TENANT_CHAT ||
            (p.thread as any).linkedEntityType === ThreadLinkedEntityType.LEASE ||
            (p.thread as any).linkedEntityType === ThreadLinkedEntityType.PROPERTY),
      )
      .map((p) => (p.thread as any)._id);

    if (chatThreadIds.length === 0) {
      return [];
    }

    // Get full thread details sorted by most recent
    const threads = await this.threadModel
      .find({ _id: { $in: chatThreadIds } })
      .sort({ updatedAt: -1 });

    // Get lease IDs from LEASE type threads to fetch property names
    const leaseThreads = threads.filter((t) => t.linkedEntityType === ThreadLinkedEntityType.LEASE);
    const leaseIds = leaseThreads.map((t) => t.linkedEntityId);

    // Fetch leases with property information
    const leases = await this.leaseModel
      .find({ _id: { $in: leaseIds } })
      .populate({
        path: 'unit',
        select: 'unitNumber',
        populate: { path: 'property', select: 'name' },
      })
      .lean();

    // Get property IDs from PROPERTY type threads to fetch property names
    const propertyThreads = threads.filter(
      (t) => t.linkedEntityType === ThreadLinkedEntityType.PROPERTY,
    );
    const propertyIds = propertyThreads.map((t) => t.linkedEntityId);

    // Fetch properties
    const properties = await this.propertyModel
      .find({ _id: { $in: propertyIds } })
      .select('name')
      .lean();

    // Create a map of propertyId to property name
    const propertyMap = new Map<string, string>();
    properties.forEach((property: any) => {
      propertyMap.set(property._id.toString(), property.name);
    });

    // Get all participants for all threads in one query (without populate)
    const allParticipants = await this.threadParticipantModel
      .find({ thread: { $in: chatThreadIds } })
      .lean();

    // Get all unique user IDs from participants
    const allUserIds = [...new Set(allParticipants.map((p) => p.participantId.toString()))];

    // Manually load all users in one query
    const users = await this.userModel
      .find({ _id: { $in: allUserIds } })
      .select('_id firstName lastName email user_type organization_id profilePicture allowNeighborsToMessage allowGroupChatInvites')
      .lean();

    // Create a map of userId to user data
    const usersMap = new Map(users.map((user) => [user._id.toString(), user]));

    // Get all last messages for all threads in one query
    // Use threads array to maintain correct order
    const lastMessages = await Promise.all(
      threads.map((thread) =>
        this.threadMessageModel
          .findOne({ thread: thread._id })
          .sort({ createdAt: -1 })
          .populate('senderId', 'firstName lastName')
          .lean(),
      ),
    );

    // Create a map of threadId to participants
    const participantsMap = new Map<string, any[]>();
    allParticipants.forEach((participant) => {
      const threadId = participant.thread.toString();
      if (!participantsMap.has(threadId)) {
        participantsMap.set(threadId, []);
      }
      participantsMap.get(threadId).push(participant);
    });

    // Create a map of threadId to last message
    const lastMessagesMap = new Map<string, any>();
    threads.forEach((thread, index) => {
      if (lastMessages[index]) {
        lastMessagesMap.set(thread._id.toString(), lastMessages[index]);
      }
    });

    // Get unread counts for all threads in one query
    const unreadCounts = await Promise.all(
      threads.map((thread) =>
        this.threadMessageModel.countDocuments({
          thread: thread._id,
          senderId: { $ne: new Types.ObjectId(userId) }, // Not sent by current user
          readBy: { $ne: new Types.ObjectId(userId) }, // Not read by current user
        }),
      ),
    );

    // Create a map of threadId to unread count
    const unreadCountMap = new Map<string, number>();
    threads.forEach((thread, index) => {
      unreadCountMap.set(thread._id.toString(), unreadCounts[index]);
    });

    const chatSessions = threads.map((thread) => {
      const threadId = thread._id.toString();
      const participants = participantsMap.get(threadId) || [];

      // Find the other user (not the current user)
      const otherParticipant = participants.find((p) => p.participantId?.toString() !== userId);

      const lastMessage = lastMessagesMap.get(threadId);

      // Get unread count from map
      const unreadCount = unreadCountMap.get(threadId) || 0;

      // Manually load the other user data
      const otherUserId = otherParticipant?.participantId?.toString();
      const otherUserInfo = otherUserId ? usersMap.get(otherUserId) : null;

      // For PROPERTY threads, use property name as title
      // For TENANT_TENANT_GROUP threads, use thread title
      // For other threads (1-on-1 chats), leave title as null
      let title = null;
      if (thread.linkedEntityType === ThreadLinkedEntityType.PROPERTY) {
        const propertyId = thread.linkedEntityId?.toString();
        title = propertyMap.get(propertyId) || thread.title;
      } else if (thread.threadType === ThreadType.TENANT_TENANT_GROUP) {
        title = thread.title;
      }

      return {
        _id: thread._id,
        threadId: thread._id,
        title,
        linkedEntityType: thread.linkedEntityType,
        linkedEntityId: thread.linkedEntityId,
        threadType: thread.threadType,
        createdBy: thread.createdBy,
        admins: thread.admins,
        avatarUrl: thread.avatarUrl,
        otherUser: otherUserInfo
          ? {
              _id: otherUserInfo._id,
              firstName: otherUserInfo.firstName,
              lastName: otherUserInfo.lastName,
              email: otherUserInfo.email,
              user_type: otherUserInfo.user_type,
              organization_id: otherUserInfo.organization_id,
              profilePicture: otherUserInfo.profilePicture,
              allowNeighborsToMessage: otherUserInfo.allowNeighborsToMessage,
              allowGroupChatInvites: otherUserInfo.allowGroupChatInvites,
            }
          : null,
        participants: participants
          .map((p) => {
            const participantUserId = p.participantId?.toString();
            const userData = participantUserId ? usersMap.get(participantUserId) : null;
            return userData
              ? {
                  _id: userData._id,
                  firstName: userData.firstName,
                  lastName: userData.lastName,
                  email: userData.email,
                  profilePicture: userData.profilePicture,
                  allowNeighborsToMessage: userData.allowNeighborsToMessage,
                  allowGroupChatInvites: userData.allowGroupChatInvites,
                }
              : null;
          })
          .filter(Boolean),
        lastMessage: lastMessage
          ? {
              text: lastMessage.content,
              sender: lastMessage.senderId,
              createdAt: lastMessage.createdAt,
            }
          : null,
        unreadCount,
        updatedAt: thread.updatedAt,
      };
    });

    return chatSessions;
  }

  /**
   * Get messages for a chat thread
   */
  async getChatMessages(
    threadId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<any> {
    // Verify the user is a participant
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new NotFoundException('Chat session not found or access denied');
    }

    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      this.threadMessageModel
        .find({ thread: new Types.ObjectId(threadId) })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('media'),
      this.threadMessageModel.countDocuments({
        thread: new Types.ObjectId(threadId),
      }),
    ]);

    // Get unique sender IDs
    const senderIds = [...new Set(messages.map((msg) => msg.senderId?.toString()).filter(Boolean))];

    // Manually load sender information from users collection
    const senders = await this.userModel
      .find({ _id: { $in: senderIds } })
      .select('_id firstName lastName profilePicture')
      .lean();

    // Create a map of sender ID to sender info
    const senderMap = new Map(senders.map((sender) => [sender._id.toString(), sender]));

    // Process messages with media URLs
    const reversedMessages = messages.reverse();

    // Enrich media with URLs for all messages
    for (const message of reversedMessages) {
      if ((message as any).media && (message as any).media.length > 0) {
        const enrichedMedia = await Promise.all(
          (message as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
        );
        (message as any).media = enrichedMedia;
      }
    }

    const messagesWithMedia = reversedMessages.map((msg) => {
      const senderId = msg.senderId?.toString();
      const sender = senderId ? senderMap.get(senderId) : null;

      return {
        _id: msg._id,
        message: msg.content,
        content: msg.content,
        sender: sender || null, // User object with firstName, lastName, profilePicture
        senderId: msg.senderId, // User ID
        senderType: msg.senderType,
        isSystemMessage: msg.isSystemMessage || false,
        systemMessageType: msg.systemMessageType,
        metadata: msg.metadata,
        media: (msg as any).media || [],
        createdAt: msg.createdAt,
        updatedAt: msg.updatedAt,
      };
    });

    return {
      messages: messagesWithMedia,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Send a message in a chat thread
   */
  async sendMessage(
    threadId: string,
    userId: string,
    message: string,
    media?: MemoryStoredFile[],
    currentUser?: User,
  ): Promise<ThreadMessageDocument> {
    // Verify the user is a participant
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new NotFoundException('Chat session not found or access denied');
    }

    const threadMessage = new this.threadMessageModel({
      thread: new Types.ObjectId(threadId),
      content: message,
      senderId: new Types.ObjectId(userId),
      senderType: MessageSenderType.TENANT,
      senderModel: 'User',
      readBy: [new Types.ObjectId(userId)], // Sender has read their own message
    });

    const savedMessage = await threadMessage.save();

    // Upload media files if provided
    if (media && media.length > 0 && currentUser) {
      for (const file of media) {
        // Validate media type (only image or PDF allowed)
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/jpg',
          'application/pdf',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          // Delete the message and throw error
          await this.threadMessageModel.findByIdAndDelete(savedMessage._id);
          throw new BadRequestException(
            `Invalid media type. Only images and PDFs are allowed. Found: ${file.mimetype}`,
          );
        }

        try {
          // Upload media and link to the message
          await this.mediaService.upload(
            file,
            savedMessage,
            currentUser,
            'chat-messages',
            undefined,
            'ThreadMessage',
          );
        } catch (error) {
          // If upload fails, delete the message and re-throw
          await this.threadMessageModel.findByIdAndDelete(savedMessage._id);
          throw error;
        }
      }
    }

    // Update thread's updatedAt
    await this.threadModel.findByIdAndUpdate(threadId, {
      updatedAt: new Date(),
    });

    // Populate media
    const messageWithMedia = await this.threadMessageModel
      .findById(savedMessage._id)
      .populate('media')
      .exec();

    // Manually fetch sender info (since senderId is polymorphic)
    const senderInfo = await this.userModel
      .findById(userId)
      .select('_id firstName lastName profilePicture')
      .lean();

    // Enrich media with URLs
    const hasAttachments =
      messageWithMedia &&
      (messageWithMedia as any).media &&
      (messageWithMedia as any).media.length > 0;

    if (hasAttachments) {
      const enrichedMedia = await Promise.all(
        (messageWithMedia as any).media.map((media: any) =>
          this.mediaService.enrichMediaWithUrl(media),
        ),
      );
      (messageWithMedia as any).media = enrichedMedia;
    }

    // Get all participants to send WebSocket notification
    const allParticipants = await this.threadParticipantModel
      .find({
        thread: new Types.ObjectId(threadId),
      })
      .populate('participantId');

    // Collect user IDs for WebSocket emission (participants are now users directly)
    const participantUserIds = allParticipants
      .map((p) => p.participantId?.toString())
      .filter(Boolean);

    // Emit WebSocket event to all participants
    if (participantUserIds.length > 0) {
      // Format message to match the REST API response structure
      const messageToEmit = {
        _id: messageWithMedia._id,
        message: messageWithMedia.content,
        content: messageWithMedia.content,
        sender: senderInfo,
        senderId: savedMessage.senderId, // Original ObjectId
        senderType: messageWithMedia.senderType,
        isSystemMessage: messageWithMedia.isSystemMessage || false,
        systemMessageType: messageWithMedia.systemMessageType,
        metadata: messageWithMedia.metadata,
        media: (messageWithMedia as any).media || [],
        createdAt: messageWithMedia.createdAt,
        updatedAt: messageWithMedia.updatedAt,
      };

      this.chatGateway.emitMessageToThread(participantUserIds, threadId, messageToEmit);
    }

    // Send notification to other participant
    const otherParticipant = allParticipants.find((p) => p.participantId?.toString() !== userId);

    if (otherParticipant?.participantId) {
      const otherUserId = otherParticipant.participantId as any;
      const sender = await this.userModel.findById(userId);
      const recipient = await this.userModel.findById(otherUserId._id);
      const dashboardPath =
        recipient?.user_type === 'Landlord'
          ? 'landlord'
          : recipient?.user_type === 'Contractor'
            ? 'contractor'
            : 'tenant';
      await this.notificationsService.createNotification(
        otherUserId._id,
        'New message',
        `${sender.firstName} ${sender.lastName} sent you a message`,
        `/dashboard/${dashboardPath}/chat`,
      );
    }

    return messageWithMedia || savedMessage;
  }

  /**
   * Mark messages as read
   */
  async markAsRead(threadId: string, userId: string): Promise<void> {
    // Verify the user is a participant
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new NotFoundException('Chat session not found or access denied');
    }

    // Mark all unread messages in this thread as read by this user
    await this.threadMessageModel.updateMany(
      {
        thread: new Types.ObjectId(threadId),
        senderId: { $ne: new Types.ObjectId(userId) }, // Don't mark own messages
        readBy: { $ne: new Types.ObjectId(userId) }, // Not already read
      },
      {
        $addToSet: { readBy: new Types.ObjectId(userId) },
      },
    );

    // Get all participants to emit read event
    const allParticipants = await this.threadParticipantModel
      .find({
        thread: new Types.ObjectId(threadId),
      })
      .populate('participantId');

    const participantUserIds = allParticipants
      .map((p) => p.participantId?.toString())
      .filter(Boolean);

    // Emit read event to all participants
    if (participantUserIds.length > 0) {
      this.chatGateway.emitMessageRead(participantUserIds, threadId, userId);
    }
  }

  /**
   * Create a group chat with multiple participants
   */
  async createGroupChat(
    currentUserId: string,
    title: string,
    participantIds: string[],
    avatarUrl?: string,
  ): Promise<ThreadDocument> {
    // Validate current user exists and privacy settings allow group creation
    const currentUser = await this.userModel.findById(currentUserId);
    if (!currentUser) {
      throw new NotFoundException('Current user not found');
    }

    if (!currentUser.allowGroupChatInvites) {
      throw new ForbiddenException('Your privacy settings do not allow creating group chats');
    }

    // Validate all participant users exist
    const participants = await this.userModel.find({
      _id: { $in: participantIds },
    });

    if (participants.length !== participantIds.length) {
      throw new BadRequestException('One or more participants not found');
    }

    // Check that current user is not trying to create a group with themselves only
    if (participantIds.length === 1 && participantIds[0] === currentUserId) {
      throw new BadRequestException('Cannot create group chat with only yourself');
    }

    // Check privacy settings for each participant (excluding current user)
    const usersWithDisabledInvites = participants.filter(
      (user) => user._id.toString() !== currentUserId && !user.allowGroupChatInvites,
    );

    if (usersWithDisabledInvites.length > 0) {
      const userNames = usersWithDisabledInvites
        .map((user) => `${user.firstName} ${user.lastName}`)
        .join(', ');
      throw new ForbiddenException(
        `The following users have disabled group chat invites: ${userNames}`,
      );
    }

    // Add current user to participants if not already included
    const allParticipantIds = new Set([...participantIds, currentUserId]);

    // Create group chat thread with admin settings
    const thread = new this.threadModel({
      title,
      linkedEntityType: ThreadLinkedEntityType.TENANT_CHAT,
      linkedEntityId: new Types.ObjectId(currentUserId), // Use creator's ID as linked entity
      linkedEntityModel: 'User',
      threadType: ThreadType.TENANT_TENANT_GROUP,
      createdBy: new Types.ObjectId(currentUserId),
      admins: [new Types.ObjectId(currentUserId)], // Creator is the first admin
      avatarUrl,
    });

    const savedThread = await thread.save();

    // Create participants for all users
    const participantRecords = Array.from(allParticipantIds).map((userId) => ({
      thread: savedThread._id,
      participantType: ParticipantType.TENANT,
      participantId: new Types.ObjectId(userId),
      participantModel: 'User',
      status: ParticipantStatus.ACCEPTED,
    }));

    await this.threadParticipantModel.insertMany(participantRecords);

    // Create system message for group creation
    await this.createSystemMessage(
      savedThread._id.toString(),
      SystemMessageType.USER_JOINED,
      `${currentUser.firstName} ${currentUser.lastName} created the group`,
      { userId: currentUserId },
    );

    return savedThread;
  }

  /**
   * Add members to a group chat
   */
  async addGroupMembers(threadId: string, currentUserId: string, userIds: string[]): Promise<void> {
    // Verify the thread exists and is a group chat
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundException('Group chat not found');
    }

    if (thread.threadType !== ThreadType.TENANT_TENANT_GROUP) {
      throw new BadRequestException('This operation is only allowed for group chats');
    }

    // Property groups bypass admin check, otherwise require admin
    const isPropertyWideGroup = thread.linkedEntityType === ThreadLinkedEntityType.PROPERTY;

    if (!isPropertyWideGroup) {
      // For private groups, check if user is admin
      const isAdmin = await this.isGroupAdmin(threadId, currentUserId);
      if (!isAdmin) {
        throw new ForbiddenException('Only group admins can add members to private groups');
      }
    } else {
      // For property groups, verify current user is a participant
      const currentUserParticipant = await this.threadParticipantModel.findOne({
        thread: new Types.ObjectId(threadId),
        participantId: new Types.ObjectId(currentUserId),
      });

      if (!currentUserParticipant) {
        throw new NotFoundException('Access denied');
      }
    }

    // Validate all new users exist
    const newUsers = await this.userModel.find({
      _id: { $in: userIds },
    });

    if (newUsers.length !== userIds.length) {
      throw new BadRequestException('One or more users not found');
    }

    // Check privacy settings for private groups (not property-wide or building/admin groups)
    // Property-wide groups (linkedEntityType === PROPERTY) bypass this check
    if (!isPropertyWideGroup) {
      // Check each user's privacy settings
      const usersWithDisabledInvites = newUsers.filter((user) => !user.allowGroupChatInvites);

      if (usersWithDisabledInvites.length > 0) {
        const userNames = usersWithDisabledInvites
          .map((user) => `${user.firstName} ${user.lastName}`)
          .join(', ');
        throw new ForbiddenException(
          `The following users have disabled group chat invites: ${userNames}`,
        );
      }
    }

    // Get existing participants
    const existingParticipants = await this.threadParticipantModel.find({
      thread: new Types.ObjectId(threadId),
    });

    const existingUserIds = new Set(existingParticipants.map((p) => p.participantId.toString()));

    // Filter out users who are already participants
    const newUserIds = userIds.filter((userId) => !existingUserIds.has(userId));

    if (newUserIds.length === 0) {
      return; // No new users to add
    }

    // Create participant records for new users
    const newParticipantRecords = newUserIds.map((userId) => ({
      thread: new Types.ObjectId(threadId),
      participantType: ParticipantType.TENANT,
      participantId: new Types.ObjectId(userId),
      participantModel: 'User',
      status: ParticipantStatus.ACCEPTED,
    }));

    await this.threadParticipantModel.insertMany(newParticipantRecords);

    // Create system messages for each added user
    const currentUser = await this.userModel.findById(currentUserId);

    for (const userId of newUserIds) {
      const addedUser = newUsers.find((u) => u._id.toString() === userId);
      if (addedUser) {
        await this.createSystemMessage(
          threadId,
          SystemMessageType.USER_JOINED,
          `${currentUser.firstName} ${currentUser.lastName} added ${addedUser.firstName} ${addedUser.lastName}`,
          { addedBy: currentUserId, userId },
        );
      }
    }
  }

  /**
   * Remove a member from a group chat
   */
  async removeGroupMember(
    threadId: string,
    currentUserId: string,
    userIdToRemove: string,
  ): Promise<void> {
    // Verify the thread exists and is a group chat
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundException('Group chat not found');
    }

    if (thread.threadType !== ThreadType.TENANT_TENANT_GROUP) {
      throw new BadRequestException('This operation is only allowed for group chats');
    }

    // Check if user is trying to remove themselves
    const isSelfRemoval = currentUserId === userIdToRemove;

    if (!isSelfRemoval) {
      // For removing others, must be admin
      const isAdmin = await this.isGroupAdmin(threadId, currentUserId);
      if (!isAdmin) {
        throw new ForbiddenException('Only group admins can remove members');
      }

      // Cannot remove the group creator/owner
      if (thread.createdBy?.toString() === userIdToRemove) {
        throw new ForbiddenException('Cannot remove the group creator. Transfer ownership first.');
      }
    }

    // Verify current user is a participant
    const currentUserParticipant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(currentUserId),
    });

    if (!currentUserParticipant) {
      throw new NotFoundException('Access denied');
    }

    // Find participant to remove
    const participantToRemove = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userIdToRemove),
    });

    if (!participantToRemove) {
      throw new NotFoundException('User is not a participant in this group chat');
    }

    // Get user info for system message
    const [currentUser, removedUser] = await Promise.all([
      this.userModel.findById(currentUserId),
      this.userModel.findById(userIdToRemove),
    ]);

    // Remove the participant
    await this.threadParticipantModel.findByIdAndDelete(participantToRemove._id);

    // Remove from admins if they were an admin
    if (thread.admins?.some((adminId) => adminId.toString() === userIdToRemove)) {
      await this.threadModel.findByIdAndUpdate(threadId, {
        $pull: { admins: new Types.ObjectId(userIdToRemove) },
      });
    }

    // Create system message
    await this.createSystemMessage(
      threadId,
      SystemMessageType.USER_REMOVED,
      isSelfRemoval
        ? `${currentUser.firstName} ${currentUser.lastName} left the group`
        : `${currentUser.firstName} ${currentUser.lastName} removed ${removedUser.firstName} ${removedUser.lastName}`,
      { removedBy: currentUserId, userId: userIdToRemove, isSelfRemoval },
    );

    // Check if group has at least 2 members left, otherwise you might want to delete the thread
    const remainingParticipants = await this.threadParticipantModel.countDocuments({
      thread: new Types.ObjectId(threadId),
    });

    if (remainingParticipants < 2) {
      // Optional: Delete the thread if less than 2 members
      // await this.threadModel.findByIdAndDelete(threadId);
      // await this.threadParticipantModel.deleteMany({ thread: new Types.ObjectId(threadId) });
    }
  }

  /**
   * Helper method to create system messages
   */
  private async createSystemMessage(
    threadId: string,
    systemMessageType: SystemMessageType,
    content: string,
    metadata?: Record<string, any>,
  ): Promise<ThreadMessageDocument> {
    const systemMessage = new this.threadMessageModel({
      thread: new Types.ObjectId(threadId),
      content,
      senderType: MessageSenderType.SYSTEM,
      isSystemMessage: true,
      systemMessageType,
      metadata,
      readBy: [], // System messages start as unread
    });

    const savedMessage = await systemMessage.save();

    // Update thread's updatedAt
    await this.threadModel.findByIdAndUpdate(threadId, {
      updatedAt: new Date(),
    });

    // Get all participants to emit WebSocket event
    const allParticipants = await this.threadParticipantModel
      .find({
        thread: new Types.ObjectId(threadId),
      })
      .populate('participantId');

    const participantUserIds = allParticipants
      .map((p) => p.participantId?.toString())
      .filter(Boolean);

    // Emit WebSocket event to all participants
    if (participantUserIds.length > 0) {
      const messageToEmit = {
        _id: savedMessage._id,
        message: savedMessage.content,
        content: savedMessage.content,
        sender: null,
        senderId: null,
        senderType: MessageSenderType.SYSTEM,
        isSystemMessage: true,
        systemMessageType,
        metadata,
        media: [],
        createdAt: savedMessage.createdAt,
        updatedAt: savedMessage.updatedAt,
      };

      this.chatGateway.emitMessageToThread(participantUserIds, threadId, messageToEmit);
    }

    return savedMessage;
  }

  /**
   * Check if user is admin of a group
   */
  private async isGroupAdmin(threadId: string, userId: string): Promise<boolean> {
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      return false;
    }

    return thread.admins?.some((adminId) => adminId.toString() === userId) || false;
  }

  /**
   * Leave a group chat
   */
  async leaveGroup(threadId: string, userId: string): Promise<void> {
    // Verify the thread exists and is a group chat
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundException('Group chat not found');
    }

    if (thread.threadType !== ThreadType.TENANT_TENANT_GROUP) {
      throw new BadRequestException('This operation is only allowed for group chats');
    }

    // Check if this is a property group
    if (thread.linkedEntityType === ThreadLinkedEntityType.PROPERTY) {
      // For property groups, check if user has active leases in the property
      const propertyId = thread.linkedEntityId;
      const user = await this.userModel.findById(userId);

      if (!user || !user.organization_id) {
        throw new NotFoundException('User not found');
      }

      // Find active leases for this tenant in this property
      const activeLeases = await this.leaseModel
        .find({
          tenant: user.organization_id,
          property: propertyId,
          status: { $in: ['Active', 'Pending'] },
        })
        .populate('unit');

      if (activeLeases.length > 0) {
        throw new ForbiddenException(
          'Cannot leave property group while you have active leases in this property',
        );
      }
    }

    // Verify user is a participant
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new NotFoundException('You are not a participant in this group chat');
    }

    // Get user info for system message
    const user = await this.userModel.findById(userId);

    // Remove the participant
    await this.threadParticipantModel.findByIdAndDelete(participant._id);

    // Remove from admins if they were an admin
    if (thread.admins?.some((adminId) => adminId.toString() === userId)) {
      await this.threadModel.findByIdAndUpdate(threadId, {
        $pull: { admins: new Types.ObjectId(userId) },
      });
    }

    // Create system message
    await this.createSystemMessage(
      threadId,
      SystemMessageType.USER_LEFT,
      `${user.firstName} ${user.lastName} left the group`,
      { userId },
    );

    // Check if group is empty or has only 1 member left
    const remainingParticipants = await this.threadParticipantModel.countDocuments({
      thread: new Types.ObjectId(threadId),
    });

    if (remainingParticipants < 2) {
      // Optional: Delete the thread if less than 2 members
      // await this.threadModel.findByIdAndDelete(threadId);
      // await this.threadParticipantModel.deleteMany({ thread: new Types.ObjectId(threadId) });
    }
  }

  /**
   * Update group name
   */
  async updateGroupName(threadId: string, currentUserId: string, newName: string): Promise<void> {
    // Verify the thread exists and is a group chat
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundException('Group chat not found');
    }

    if (thread.threadType !== ThreadType.TENANT_TENANT_GROUP) {
      throw new BadRequestException('This operation is only allowed for group chats');
    }

    // Check if user is admin
    const isAdmin = await this.isGroupAdmin(threadId, currentUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only group admins can change the group name');
    }

    const oldName = thread.title;

    // Update the group name
    await this.threadModel.findByIdAndUpdate(threadId, {
      title: newName,
      updatedAt: new Date(),
    });

    // Get user info for system message
    const user = await this.userModel.findById(currentUserId);

    // Create system message
    await this.createSystemMessage(
      threadId,
      SystemMessageType.GROUP_RENAMED,
      `${user.firstName} ${user.lastName} changed the group name to "${newName}"`,
      { userId: currentUserId, oldName, newName },
    );
  }

  /**
   * Update group avatar
   */
  async updateGroupAvatar(
    threadId: string,
    currentUserId: string,
    avatarUrl: string,
  ): Promise<void> {
    // Verify the thread exists and is a group chat
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundException('Group chat not found');
    }

    if (thread.threadType !== ThreadType.TENANT_TENANT_GROUP) {
      throw new BadRequestException('This operation is only allowed for group chats');
    }

    // Check if user is admin
    const isAdmin = await this.isGroupAdmin(threadId, currentUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only group admins can change the group avatar');
    }

    // Update the group avatar
    await this.threadModel.findByIdAndUpdate(threadId, {
      avatarUrl,
      updatedAt: new Date(),
    });

    // Get user info for system message
    const user = await this.userModel.findById(currentUserId);

    // Create system message
    await this.createSystemMessage(
      threadId,
      SystemMessageType.AVATAR_CHANGED,
      `${user.firstName} ${user.lastName} changed the group avatar`,
      { userId: currentUserId },
    );
  }

  /**
   * Transfer group ownership
   */
  async transferOwnership(
    threadId: string,
    currentUserId: string,
    newOwnerId: string,
  ): Promise<void> {
    // Verify the thread exists and is a group chat
    const thread = await this.threadModel.findById(threadId);

    if (!thread) {
      throw new NotFoundException('Group chat not found');
    }

    if (thread.threadType !== ThreadType.TENANT_TENANT_GROUP) {
      throw new BadRequestException('This operation is only allowed for group chats');
    }

    // Only the creator can transfer ownership
    if (thread.createdBy?.toString() !== currentUserId) {
      throw new ForbiddenException('Only the group creator can transfer ownership');
    }

    // Verify new owner is a participant
    const newOwnerParticipant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(newOwnerId),
    });

    if (!newOwnerParticipant) {
      throw new BadRequestException('New owner must be a participant in the group');
    }

    // Verify new owner exists
    const newOwner = await this.userModel.findById(newOwnerId);
    if (!newOwner) {
      throw new NotFoundException('New owner not found');
    }

    // Update ownership
    await this.threadModel.findByIdAndUpdate(threadId, {
      createdBy: new Types.ObjectId(newOwnerId),
      $addToSet: { admins: new Types.ObjectId(newOwnerId) }, // Ensure new owner is admin
      updatedAt: new Date(),
    });

    // Get current user info for system message
    const currentUser = await this.userModel.findById(currentUserId);

    // Create system message
    await this.createSystemMessage(
      threadId,
      SystemMessageType.OWNERSHIP_TRANSFERRED,
      `${currentUser.firstName} ${currentUser.lastName} transferred ownership to ${newOwner.firstName} ${newOwner.lastName}`,
      { fromUserId: currentUserId, toUserId: newOwnerId },
    );
  }
}
