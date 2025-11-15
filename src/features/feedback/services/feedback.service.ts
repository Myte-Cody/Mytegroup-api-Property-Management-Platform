import { ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';
import { CreateFeedbackDto } from '../dto/create-feedback.dto';
import {
  FeedbackEntry,
  FeedbackEntryDocument,
  FeedbackMessageRole,
  FeedbackPriority,
  FeedbackStatus,
} from '../schemas/feedback.schema';
import { FeedbackQueueService } from './feedback-queue.service';
import { UsersService } from '../../users/users.service';

const HOURLY_LIMIT = 5;
const DAILY_LIMIT = 15;

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(FeedbackEntry.name)
    private readonly feedbackModel: Model<FeedbackEntryDocument>,
    private readonly feedbackQueue: FeedbackQueueService,
    private readonly usersService: UsersService,
  ) {}

  async createFeedback(user: User, dto: CreateFeedbackDto): Promise<FeedbackEntry> {
    await this.enforceRateLimits(user._id?.toString());

    const conversation = dto.conversation.map((message) => ({
      role: message.role,
      content: message.content.trim(),
      timestamp: new Date(message.timestamp),
    }));

    const entry = await this.feedbackModel.create({
      user: user._id,
      userEmail: user.email,
      priority: dto.priority ?? this.derivePriorityFromConversation(conversation),
      conversation,
      status: FeedbackStatus.PENDING,
    });

    await this.feedbackQueue.enqueueAnalysis(entry._id.toString());

    return entry.toObject();
  }

  /**
   * Create a feedback entry from public landing chat if the email corresponds to an existing user.
   * If no matching user is found, it logs and returns undefined without failing the flow.
   */
  async createFromLandingEmail(
    email: string,
    conversation: { role: 'user' | 'assistant'; content: string }[],
    classification: { summary: string; tags: string[]; sentiment: string; priority: FeedbackPriority },
  ): Promise<FeedbackEntry | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user) {
      // No app user yet; skip persisting to feedback collection
      return undefined;
    }

    const now = new Date();
    const mappedConversation = conversation.map((m) => ({
      role: m.role === 'user' ? FeedbackMessageRole.USER : FeedbackMessageRole.ASSISTANT,
      content: m.content.trim(),
      timestamp: now, // best-effort timestamp for landing transcript
    }));

    const entry = await this.feedbackModel.create({
      user: user._id,
      userEmail: user.email,
      priority: classification.priority,
      conversation: mappedConversation,
      status: FeedbackStatus.COMPLETED,
      analysis: {
        summary: classification.summary,
        actionItems: [],
        tags: classification.tags ?? [],
        sentiment: classification.sentiment ?? 'neutral',
        recommendedPriority: classification.priority,
      },
      analyzedAt: now,
    });

    return entry.toObject();
  }

  async getFeedbackById(id: string, userId: string): Promise<FeedbackEntry> {
    const entry = await this.feedbackModel.findById(id).lean();
    if (!entry) {
      throw new NotFoundException('Feedback not found');
    }

    if (entry.user.toString() !== userId) {
      throw new ForbiddenException();
    }

    return entry;
  }

  async listFeedback(userId: string, limit = 20): Promise<FeedbackEntry[]> {
    return this.feedbackModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 100))
      .lean();
  }

  private async enforceRateLimits(userId: Types.ObjectId | string): Promise<void> {
    const normalizedUserId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [hourCount, dayCount] = await Promise.all([
      this.feedbackModel.countDocuments({ user: normalizedUserId, createdAt: { $gte: hourAgo } }),
      this.feedbackModel.countDocuments({ user: normalizedUserId, createdAt: { $gte: dayAgo } }),
    ]);

    if (hourCount >= HOURLY_LIMIT) {
      throw new HttpException(`You can only submit ${HOURLY_LIMIT} feedback items per hour.`, HttpStatus.TOO_MANY_REQUESTS);
    }

    if (dayCount >= DAILY_LIMIT) {
      throw new HttpException(`You can only submit ${DAILY_LIMIT} feedback items per day.`, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private derivePriorityFromConversation(conversation: FeedbackEntry['conversation']): FeedbackPriority {
    const urgentPattern = /urgent|blocker|critical|can't|cannot|down|outage|asap/i;
    if (conversation.some((message) => message.role === FeedbackMessageRole.USER && urgentPattern.test(message.content))) {
      return FeedbackPriority.HIGH;
    }
    return FeedbackPriority.MEDIUM;
  }
}
