import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscribersModule } from '../subscribers/subscribers.module';
import { UsersModule } from '../users/users.module';
import { FeedbackController } from './controllers/feedback.controller';
import { LandingFeedbackController } from './controllers/landing-feedback.controller';
import { FeedbackProcessor } from './processors/feedback.processor';
import { FeedbackEntry, FeedbackEntrySchema } from './schemas/feedback.schema';
import { FeedbackAnalysisService } from './services/feedback-analysis.service';
import { FeedbackQueueService } from './services/feedback-queue.service';
import { FeedbackService } from './services/feedback.service';
import { LandingChatFeedbackService } from './services/landing-chat-feedback.service';

const enableQueues = process.env.REDIS_DISABLE !== 'true';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: FeedbackEntry.name, schema: FeedbackEntrySchema }]),
    ...(enableQueues
      ? [
          BullModule.registerQueue({
            name: 'feedback-analysis',
            connection: {
              host: process.env.REDIS_HOST || 'localhost',
              port: parseInt(process.env.REDIS_PORT || '6379', 10),
              password: process.env.REDIS_PASSWORD,
            },
            defaultJobOptions: {
              removeOnComplete: 100,
              removeOnFail: 50,
            },
          }),
        ]
      : []),
    SubscribersModule,
    UsersModule,
  ],
  controllers: [FeedbackController, LandingFeedbackController],
  providers: [
    FeedbackService,
    FeedbackQueueService,
    FeedbackAnalysisService,
    FeedbackProcessor,
    LandingChatFeedbackService,
  ],
  exports: [FeedbackService],
})
export class FeedbackModule {}
