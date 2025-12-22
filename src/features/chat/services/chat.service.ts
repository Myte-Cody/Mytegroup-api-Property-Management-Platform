import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MemoryStoredFile } from 'nestjs-form-data';
import { UserType } from '../../../common/enums/user-type.enum';
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
import { Media } from '../../media/schemas/media.schema';
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
    @InjectModel(Media.name)
    private mediaModel: Model<Media>,
    private notificationsService: NotificationsService,
    private chatGateway: ChatGateway,
    private mediaService: MediaService,
  ) {}

  /**
   * Get fresh profile picture URLs for a list of user IDs
   * This is needed because presigned S3 URLs expire after 1 hour
   */
  private async refreshProfilePictureUrls(userIds: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    if (userIds.length === 0) return urlMap;

    // Query Media collection for profile pictures of these users
    const profilePictures = await this.mediaModel
      .find({
        model_type: 'User',
        model_id: { $in: userIds.map((id) => new Types.ObjectId(id)) },
        collection_name: 'profile-pictures',
      })
      .lean();

    // Generate fresh presigned URLs for each profile picture
    for (const media of profilePictures) {
      const userId = media.model_id.toString();
      try {
        const freshUrl = await this.mediaService.getMediaUrl(media as any);
        urlMap.set(userId, freshUrl);
      } catch {
        // If URL generation fails, skip this user's profile picture
      }
    }

    return urlMap;
  }

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

    // Check if either user has blocked the other
    const isBlocked = await this.isUserBlocked(currentUserId, otherUserId);
    const isBlockedBy = await this.isUserBlocked(otherUserId, currentUserId);

    if (isBlocked) {
      throw new ForbiddenException('You have blocked this user');
    }

    if (isBlockedBy) {
      throw new ForbiddenException('You cannot message this user');
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
      .select(
        '_id firstName lastName email user_type organization_id profilePicture allowNeighborsToMessage allowGroupChatInvites',
      )
      .lean();

    // Get fresh profile picture URLs (stored URLs may have expired)
    const freshProfilePictureUrls = await this.refreshProfilePictureUrls(allUserIds);

    // Create a map of userId to user data with fresh profile picture URLs
    const usersMap = new Map(
      users.map((user) => {
        const id = user._id.toString();
        const freshUrl = freshProfilePictureUrls.get(id);
        return [
          id,
          {
            ...user,
            profilePicture: freshUrl || user.profilePicture,
          },
        ];
      }),
    );

    // Create a map of threadId to participants and clearedAt for current user
    const participantsMap = new Map<string, any[]>();
    const clearedAtMap = new Map<string, Date | null>();
    allParticipants.forEach((participant) => {
      const threadId = participant.thread.toString();
      if (!participantsMap.has(threadId)) {
        participantsMap.set(threadId, []);
      }
      participantsMap.get(threadId).push(participant);

      // Track clearedAt for the current user
      if (participant.participantId.toString() === userId && participant.clearedAt) {
        clearedAtMap.set(threadId, participant.clearedAt);
      }
    });

    // Get all last messages for all threads in one query
    // Filter by clearedAt if user has cleared history for that thread
    const lastMessages = await Promise.all(
      threads.map((thread) => {
        const clearedAt = clearedAtMap.get(thread._id.toString());
        const query: any = { thread: thread._id };
        if (clearedAt) {
          query.createdAt = { $gt: clearedAt };
        }
        return this.threadMessageModel
          .findOne(query)
          .sort({ createdAt: -1 })
          .populate('senderId', 'firstName lastName')
          .lean();
      }),
    );

    // Create a map of threadId to last message
    const lastMessagesMap = new Map<string, any>();
    threads.forEach((thread, index) => {
      if (lastMessages[index]) {
        lastMessagesMap.set(thread._id.toString(), lastMessages[index]);
      }
    });

    // Get unread counts for all threads in one query
    // Filter by clearedAt if user has cleared history for that thread
    const unreadCounts = await Promise.all(
      threads.map((thread) => {
        const clearedAt = clearedAtMap.get(thread._id.toString());
        const query: any = {
          thread: thread._id,
          senderId: { $ne: new Types.ObjectId(userId) }, // Not sent by current user
          readBy: { $ne: new Types.ObjectId(userId) }, // Not read by current user
        };
        if (clearedAt) {
          query.createdAt = { $gt: clearedAt };
        }
        return this.threadMessageModel.countDocuments(query);
      }),
    );

    // Create a map of threadId to unread count
    const unreadCountMap = new Map<string, number>();
    threads.forEach((thread, index) => {
      unreadCountMap.set(thread._id.toString(), unreadCounts[index]);
    });

    const currentUser = await this.userModel.findById(userId).select('mutedThreads').lean();

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
        isMuted: currentUser?.mutedThreads.find((mt: any) => mt.threadId.toString() === threadId)
          ? true
          : false,
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

    // Build message query - filter by clearedAt if user has cleared history
    const messageQuery: any = { thread: new Types.ObjectId(threadId) };
    if (participant.clearedAt) {
      messageQuery.createdAt = { $gt: participant.clearedAt };
    }

    const [messages, total] = await Promise.all([
      this.threadMessageModel
        .find(messageQuery)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('media'),
      this.threadMessageModel.countDocuments(messageQuery),
    ]);

    // Get unique sender IDs
    const senderIds = [...new Set(messages.map((msg) => msg.senderId?.toString()).filter(Boolean))];

    // Get unique user IDs from readBy arrays
    const readByUserIds = [
      ...new Set(
        messages.flatMap((msg) => msg.readBy?.map((id) => id.toString()) || []).filter(Boolean),
      ),
    ];

    // Combine all user IDs we need to fetch
    const allUserIds = [...new Set([...senderIds, ...readByUserIds])];

    // Manually load user information from users collection
    const users = await this.userModel
      .find({ _id: { $in: allUserIds } })
      .select('_id firstName lastName profilePicture')
      .lean();

    // Get fresh profile picture URLs (stored URLs may have expired)
    const freshProfilePictureUrls = await this.refreshProfilePictureUrls(allUserIds);

    // Create a map of user ID to user info with fresh profile picture URLs
    const userMap = new Map(
      users.map((user) => {
        const userId = user._id.toString();
        const freshUrl = freshProfilePictureUrls.get(userId);
        return [
          userId,
          {
            ...user,
            profilePicture: freshUrl || user.profilePicture,
          },
        ];
      }),
    );

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

    // Get current user's blocked users and check if this is a group chat
    const { usersYouBlocked, usersWhoBlockedYou } = await this.getBlockedUsers(userId);
    const blockedUserIds =
      [...(usersYouBlocked ?? []), ...(usersWhoBlockedYou ?? [])].map((user) =>
        user._id.toString(),
      ) || [];
    const thread = await this.threadModel.findById(threadId).lean();
    const isGroupChat = thread?.threadType === ThreadType.TENANT_TENANT_GROUP;

    const messagesWithMedia = reversedMessages
      .filter((msg) => {
        // In one-to-one chats, filter out messages from blocked users
        // In group chats, keep all messages but mark sender as blocked
        if (isGroupChat) return true;

        const senderId = msg.senderId?.toString();
        return !senderId || !blockedUserIds.includes(senderId);
      })
      .map((msg) => {
        const senderId = msg.senderId?.toString();
        const isBlocked = senderId && blockedUserIds.includes(senderId);
        const sender = senderId ? userMap.get(senderId) : null;

        // Transform readBy array to include user info
        const readByWithUserInfo = (msg.readBy || [])
          .map((userId) => {
            const userIdStr = userId.toString();
            const user = userMap.get(userIdStr);
            if (user) {
              return {
                userId: userIdStr,
                userName: `${user.firstName} ${user.lastName}`.trim(),
              };
            }
            return null;
          })
          .filter(Boolean);

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
          readBy: readByWithUserInfo, // Array of { userId, userName } objects
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
          isBlockedSender: isBlocked, // Flag to indicate if sender is blocked
        };
      });

    return {
      messages: messagesWithMedia,
      pagination: {
        total: messagesWithMedia.length, // Updated to reflect filtered count
        page,
        limit,
        pages: Math.ceil(messagesWithMedia.length / limit),
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

    // Check if this is a 1-on-1 chat and verify no blocking
    const thread = await this.threadModel.findById(threadId);
    if (thread?.threadType === ThreadType.TENANT_TENANT) {
      // Get other participant
      const allParticipants = await this.threadParticipantModel.find({
        thread: new Types.ObjectId(threadId),
      });
      const otherParticipant = allParticipants.find((p) => p.participantId?.toString() !== userId);

      if (otherParticipant) {
        const otherUserId = otherParticipant.participantId?.toString();
        const isBlocked = await this.isUserBlocked(userId, otherUserId);
        const isBlockedBy = await this.isUserBlocked(otherUserId, userId);

        if (isBlocked) {
          throw new ForbiddenException('You have blocked this user');
        }

        if (isBlockedBy) {
          throw new ForbiddenException('You cannot message this user');
        }
      }
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
    const senderInfoRaw = await this.userModel
      .findById(userId)
      .select('_id firstName lastName profilePicture')
      .lean();

    // Get fresh profile picture URL for sender
    const freshSenderUrls = await this.refreshProfilePictureUrls([userId]);
    const senderInfo = senderInfoRaw
      ? {
          ...senderInfoRaw,
          profilePicture: freshSenderUrls.get(userId) || senderInfoRaw.profilePicture,
        }
      : null;

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
        readBy: messageWithMedia.readBy || [], // List of user IDs who have read this message
        createdAt: messageWithMedia.createdAt,
        updatedAt: messageWithMedia.updatedAt,
      };

      this.chatGateway.emitMessageToThread(participantUserIds, threadId, messageToEmit);
    }

    // Send notification to other participant (only if thread is not muted)
    const otherParticipant = allParticipants.find((p) => p.participantId?.toString() !== userId);

    if (otherParticipant?.participantId) {
      const otherUserId = otherParticipant.participantId as any;

      // Check if the thread is muted for the recipient
      const isMuted = await this.isThreadMuted(otherUserId._id.toString(), threadId);

      if (!isMuted) {
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
    const user = await this.userModel.findById(userId);
    // Emit read event to all participants
    if (participantUserIds.length > 0) {
      this.chatGateway.emitMessageRead(participantUserIds, threadId, user, new Date());
    }
  }

  /**
   * Edit a message
   * - Verify message ownership
   * - Check if user can edit (considering chat type restrictions)
   * - Update content and metadata
   * - Emit WebSocket event
   */
  async editMessage(
    threadId: string,
    messageId: string,
    userId: string,
    newContent: string,
    currentUser: User,
  ): Promise<ThreadMessageDocument> {
    // 1. Find the message
    const message = await this.threadMessageModel.findOne({
      _id: new Types.ObjectId(messageId),
      thread: new Types.ObjectId(threadId),
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // 2. Verify user is a participant in the thread
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this thread');
    }

    // 3. Check ownership
    if (message.senderId?.toString() !== userId) {
      throw new ForbiddenException('You can only edit your own messages');
    }

    // 4. Check if message is a system message (cannot edit)
    if (message.isSystemMessage) {
      throw new ForbiddenException('Cannot edit system messages');
    }

    // 5. Get thread details to check linkedEntityType
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // 6. CRITICAL: Property group chat restriction for tenants
    if (
      thread.linkedEntityType === ThreadLinkedEntityType.PROPERTY &&
      currentUser.user_type === UserType.TENANT
    ) {
      throw new ForbiddenException(
        'Tenants cannot edit their messages in property group chats',
      );
    }

    // 7. Store original content if not already stored (first edit)
    if (!message.originalContent) {
      message.originalContent = message.content;
    }

    // 8. Update the message
    message.content = newContent;
    message.isEdited = true;
    message.editedAt = new Date();
    const updatedMessage = await message.save();

    // 9. Populate media if exists
    await updatedMessage.populate('media');

    // 10. Emit WebSocket event to all participants
    const allParticipants = await this.threadParticipantModel
      .find({ thread: new Types.ObjectId(threadId) })
      .populate('participantId');

    const participantUserIds = allParticipants
      .map((p) => p.participantId?.toString())
      .filter(Boolean);

    if (participantUserIds.length > 0) {
      // Get sender info with fresh profile picture
      const senderInfoRaw = await this.userModel
        .findById(userId)
        .select('_id firstName lastName profilePicture')
        .lean();
      const freshSenderUrls = await this.refreshProfilePictureUrls([userId]);
      const senderInfo = senderInfoRaw
        ? {
            ...senderInfoRaw,
            profilePicture: freshSenderUrls.get(userId) || senderInfoRaw.profilePicture,
          }
        : null;

      // Enrich media with URLs
      let enrichedMedia = [];
      if ((updatedMessage as any).media && (updatedMessage as any).media.length > 0) {
        enrichedMedia = await Promise.all(
          (updatedMessage as any).media.map((media: any) =>
            this.mediaService.enrichMediaWithUrl(media),
          ),
        );
      }

      const messageToEmit = {
        _id: updatedMessage._id,
        message: updatedMessage.content,
        content: updatedMessage.content,
        sender: senderInfo,
        senderId: updatedMessage.senderId,
        senderType: updatedMessage.senderType,
        isSystemMessage: updatedMessage.isSystemMessage || false,
        systemMessageType: updatedMessage.systemMessageType,
        metadata: updatedMessage.metadata,
        media: enrichedMedia,
        readBy: updatedMessage.readBy || [],
        isEdited: updatedMessage.isEdited,
        editedAt: updatedMessage.editedAt,
        createdAt: updatedMessage.createdAt,
        updatedAt: updatedMessage.updatedAt,
      };

      this.chatGateway.emitMessageEdited(participantUserIds, threadId, messageToEmit);
    }

    return updatedMessage;
  }

  /**
   * Delete a message (hard delete)
   * - Verify message ownership
   * - Check if user can delete (considering chat type restrictions)
   * - Delete the message permanently
   * - Emit WebSocket event
   */
  async deleteMessage(
    threadId: string,
    messageId: string,
    userId: string,
    currentUser: User,
  ): Promise<void> {
    // 1. Find the message
    const message = await this.threadMessageModel.findOne({
      _id: new Types.ObjectId(messageId),
      thread: new Types.ObjectId(threadId),
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    // 2. Verify user is a participant in the thread
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(userId),
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this thread');
    }

    // 3. Check ownership
    if (message.senderId?.toString() !== userId) {
      throw new ForbiddenException('You can only delete your own messages');
    }

    // 4. Check if message is a system message (cannot delete)
    if (message.isSystemMessage) {
      throw new ForbiddenException('Cannot delete system messages');
    }

    // 5. Get thread details to check linkedEntityType
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // 6. CRITICAL: Property group chat restriction for tenants
    if (
      thread.linkedEntityType === ThreadLinkedEntityType.PROPERTY &&
      currentUser.user_type === UserType.TENANT
    ) {
      throw new ForbiddenException(
        'Tenants cannot delete their messages in property group chats',
      );
    }

    // 7. Delete associated media files if any
    if ((message as any).media && (message as any).media.length > 0) {
      await this.mediaModel.deleteMany({
        model_type: 'ThreadMessage',
        model_id: new Types.ObjectId(messageId),
      });
    }

    // 8. Hard delete the message
    await this.threadMessageModel.deleteOne({ _id: new Types.ObjectId(messageId) });

    // 9. Emit WebSocket event to all participants
    const allParticipants = await this.threadParticipantModel
      .find({ thread: new Types.ObjectId(threadId) })
      .populate('participantId');

    const participantUserIds = allParticipants
      .map((p) => p.participantId?.toString())
      .filter(Boolean);

    if (participantUserIds.length > 0) {
      this.chatGateway.emitMessageDeleted(participantUserIds, threadId, messageId);
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
        readBy: savedMessage.readBy || [], // List of user IDs who have read this message
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
    avatarFile?: MemoryStoredFile,
    currentUser?: User,
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

    // If no file provided, throw error
    if (!avatarFile) {
      throw new BadRequestException('Avatar file is required');
    }

    // Upload the avatar file
    let avatarUrl: string | undefined;
    if (avatarFile && currentUser) {
      try {
        // Upload the file to storage
        const uploadedMedia = await this.mediaService.upload(
          avatarFile,
          thread,
          currentUser,
          'group-avatars',
          undefined,
          'Thread',
        );

        // Get the URL of the uploaded file
        const enrichedMedia = await this.mediaService.enrichMediaWithUrl(uploadedMedia);
        avatarUrl = enrichedMedia.url;
      } catch (error) {
        throw new BadRequestException('Failed to upload avatar file');
      }
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

  /**
   * Block a user
   */
  async blockUser(currentUserId: string, userIdToBlock: string, currentUser: User): Promise<void> {
    // Cannot block yourself
    if (currentUserId === userIdToBlock) {
      throw new BadRequestException('Cannot block yourself');
    }

    // Verify user to block exists
    const userToBlock = await this.userModel.findById(userIdToBlock);
    if (!userToBlock) {
      throw new NotFoundException('User to block not found');
    }

    // Check if current user is a tenant and trying to block a landlord
    if (currentUser.user_type === 'Tenant' && userToBlock.user_type === 'Landlord') {
      throw new ForbiddenException('Tenants cannot block landlords');
    }

    // Add user to blocked list if not already blocked
    await this.userModel.findByIdAndUpdate(currentUserId, {
      $addToSet: { blockedUsers: new Types.ObjectId(userIdToBlock) },
    });

    // Automatically mute any existing conversations with this user
    const existingThread = await this.findExistingChat(currentUserId, userIdToBlock);
    if (existingThread) {
      await this.muteThread(currentUserId, existingThread._id.toString(), null);
    }
  }

  /**
   * Unblock a user
   */
  async unblockUser(currentUserId: string, userIdToUnblock: string): Promise<void> {
    // Remove user from blocked list
    await this.userModel.findByIdAndUpdate(currentUserId, {
      $pull: { blockedUsers: new Types.ObjectId(userIdToUnblock) },
    });
  }

  /**
   * Get list of blocked users (users you blocked and users who blocked you)
   */
  async getBlockedUsers(currentUserId: string): Promise<any> {
    // Get users that the current user has blocked
    const user = await this.userModel
      .findById(currentUserId)
      .populate('blockedUsers', 'firstName lastName email profilePicture user_type')
      .lean();

    const usersYouBlocked = user?.blockedUsers || [];

    // Find users who have blocked the current user
    const usersWhoBlockedYou = await this.userModel
      .find({
        blockedUsers: new Types.ObjectId(currentUserId),
      })
      .select('_id firstName lastName email profilePicture user_type')
      .lean();

    return {
      usersYouBlocked,
      usersWhoBlockedYou,
    };
  }

  /**
   * Mute a thread (conversation or group)
   */
  async muteThread(currentUserId: string, threadId: string, muteUntil: Date | null): Promise<void> {
    // Verify thread exists and user is a participant
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(currentUserId),
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this thread');
    }

    // Remove existing mute if present, then add new one
    await this.userModel.findByIdAndUpdate(currentUserId, {
      $pull: { mutedThreads: { threadId: new Types.ObjectId(threadId) } },
    });

    await this.userModel.findByIdAndUpdate(currentUserId, {
      $push: {
        mutedThreads: {
          threadId: new Types.ObjectId(threadId),
          muteUntil: muteUntil,
        },
      },
    });
  }

  /**
   * Unmute a thread
   */
  async unmuteThread(currentUserId: string, threadId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(currentUserId, {
      $pull: { mutedThreads: { threadId: new Types.ObjectId(threadId) } },
    });
  }

  /**
   * Clear chat history for a thread (hides messages before clearedAt timestamp for the user only)
   */
  async clearChatHistory(currentUserId: string, threadId: string): Promise<void> {
    // Verify thread exists and user is a participant
    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(currentUserId),
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this thread');
    }

    // Set clearedAt timestamp - messages before this will be hidden for this user
    await this.threadParticipantModel.findByIdAndUpdate(participant._id, {
      clearedAt: new Date(),
    });
  }

  /**
   * Check if a user is blocked by another user
   */
  async isUserBlocked(userId: string, blockedUserId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).select('blockedUsers').lean();
    if (!user) return false;

    return user.blockedUsers?.some((id) => id.toString() === blockedUserId) || false;
  }

  /**
   * Check if a thread is muted for a user
   */
  async isThreadMuted(userId: string, threadId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).select('mutedThreads').lean();
    if (!user || !user.mutedThreads) return false;

    const mutedThread = user.mutedThreads.find((mt: any) => mt.threadId.toString() === threadId);

    if (!mutedThread) return false;

    // If muteUntil is null, it's permanently muted
    if (!mutedThread.muteUntil) return true;

    // If muteUntil is in the future, it's still muted
    if (new Date(mutedThread.muteUntil) > new Date()) return true;

    // If muteUntil is in the past, unmute it automatically
    await this.unmuteThread(userId, threadId);
    return false;
  }
}
