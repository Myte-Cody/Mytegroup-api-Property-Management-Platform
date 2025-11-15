import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MessageSenderType,
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
import { NotificationsService } from '../../notifications/notifications.service';
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
    private notificationsService: NotificationsService,
    private chatGateway: ChatGateway,
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
   * Get all chat sessions for a user
   */
  async getChatSessions(userId: string): Promise<any[]> {
    // Find all participants records for this user
    const participantRecords = await this.threadParticipantModel
      .find({
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(userId),
      })
      .populate('thread');

    // Filter for TENANT_CHAT threads
    const chatThreadIds = participantRecords
      .filter(
        (p) =>
          p.thread && (p.thread as any).linkedEntityType === ThreadLinkedEntityType.TENANT_CHAT,
      )
      .map((p) => (p.thread as any)._id);

    if (chatThreadIds.length === 0) {
      return [];
    }

    // Get full thread details sorted by most recent
    const threads = await this.threadModel
      .find({ _id: { $in: chatThreadIds } })
      .sort({ updatedAt: -1 });

    // Get all participants for all threads in one query (without populate)
    const allParticipants = await this.threadParticipantModel
      .find({ thread: { $in: chatThreadIds } })
      .lean();

    // Get all unique user IDs from participants
    const allUserIds = [...new Set(allParticipants.map((p) => p.participantId.toString()))];

    // Manually load all users in one query
    const users = await this.userModel
      .find({ _id: { $in: allUserIds } })
      .select('_id firstName lastName email user_type organization_id')
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

    const chatSessions = threads.map((thread) => {
      const threadId = thread._id.toString();
      const participants = participantsMap.get(threadId) || [];

      // Find the other user (not the current user)
      const otherParticipant = participants.find((p) => p.participantId?.toString() !== userId);

      const lastMessage = lastMessagesMap.get(threadId);

      // For simplicity, we're not tracking read status yet
      const unreadCount = 0;

      // Manually load the other user data
      const otherUserId = otherParticipant?.participantId?.toString();
      const otherUserInfo = otherUserId ? usersMap.get(otherUserId) : null;

      return {
        _id: thread._id,
        threadId: thread._id,
        title: thread.title,
        otherUser: otherUserInfo
          ? {
              _id: otherUserInfo._id,
              firstName: otherUserInfo.firstName,
              lastName: otherUserInfo.lastName,
              email: otherUserInfo.email,
              user_type: otherUserInfo.user_type,
              organization_id: otherUserInfo.organization_id,
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
        .limit(limit),
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

    return {
      messages: messages.reverse().map((msg) => {
        const senderId = msg.senderId?.toString();
        const sender = senderId ? senderMap.get(senderId) : null;

        return {
          _id: msg._id,
          message: msg.content,
          content: msg.content,
          sender: sender || null, // User object with firstName, lastName, profilePicture
          senderId: msg.senderId, // User ID
          senderType: msg.senderType,
          createdAt: msg.createdAt,
          updatedAt: msg.updatedAt,
        };
      }),
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
    attachments?: string[],
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
    });

    const savedMessage = await threadMessage.save();

    // Update thread's updatedAt
    await this.threadModel.findByIdAndUpdate(threadId, {
      updatedAt: new Date(),
    });

    // Populate sender info
    await savedMessage.populate('senderId', 'firstName lastName profilePicture');

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
      this.chatGateway.emitMessageToThread(participantUserIds, threadId, savedMessage.toObject());
    }

    // Send notification to other participant
    const otherParticipant = allParticipants.find((p) => p.participantId?.toString() !== userId);

    if (otherParticipant?.participantId) {
      const otherUserId = otherParticipant.participantId as any;
      const sender = await this.userModel.findById(userId);
      await this.notificationsService.createNotification(
        otherUserId._id,
        'New message',
        `${sender.firstName} ${sender.lastName} sent you a message`,
      );
    }

    return savedMessage;
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

    // Mark all messages as read - in this simplified version, we don't track read status
    // You can add a readBy field to ThreadMessage schema if needed
  }
}
