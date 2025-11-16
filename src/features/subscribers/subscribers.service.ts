import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Subscriber, SubscriberDocument } from './schemas/subscriber.schema';

export interface SubscriberFeedbackSnapshot {
  channel: string;
  summary: string;
  tags: string[];
  actionItems: string[];
  sentiment?: string;
}

@Injectable()
export class SubscribersService {
  private readonly logger = new Logger(SubscribersService.name);

  constructor(
    @InjectModel(Subscriber.name)
    private readonly subscriberModel: Model<SubscriberDocument>,
  ) {}

  async upsertFromFeedback(email: string, snapshot: SubscriberFeedbackSnapshot, name?: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const now = new Date();

    try {
      const update: any = {
        $set: {
          email: normalizedEmail,
          name: name?.trim() || undefined,
          lastChannel: snapshot.channel,
          lastSummary: snapshot.summary,
          tags: snapshot.tags?.slice(0, 8) ?? [],
          lastActionItems: snapshot.actionItems?.slice(0, 8) ?? [],
          lastSentiment: snapshot.sentiment ?? 'neutral',
          lastFeedbackAt: now,
        },
        // Rely on Mongoose timestamps for createdAt/updatedAt to avoid conflicts
      };

      await this.subscriberModel.updateOne({ email: normalizedEmail }, update, {
        upsert: true,
        strict: false,
      });
    } catch (error) {
      // If a duplicate key error happens due to a race, treat as success
      if ((error as any)?.code === 11000) {
        this.logger.warn(
          `Subscriber ${normalizedEmail} already exists (duplicate key); continuing.`,
        );
        return;
      }
      this.logger.error(`Failed to upsert subscriber ${normalizedEmail} from feedback`, error);
      throw error;
    }
  }
}
