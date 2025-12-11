import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { CsrfGuard } from './common/guards/csrf.guard';
import configuration from './config/configuration';
import renewalConfig from './config/renewal.config';
import { AiChatModule } from './features/ai-chat/ai-chat.module';
import { AuthModule } from './features/auth/auth.module';
import { ChatModule } from './features/chat/chat.module';
import { ContractorModule } from './features/contractors/contractor.module';
import { EmailModule } from './features/email/email.module';
import { ExpensesModule } from './features/expenses/expenses.module';
import { FeedPostsModule } from './features/feed-posts/feed-posts.module';
import { FeedbackModule } from './features/feedback/feedback.module';
import { InquiriesModule } from './features/inquiries/inquiries.module';
import { InvitationsModule } from './features/invitations/invitations.module';
import { KPIModule } from './features/kpi/kpi.module';
import { LandlordModule } from './features/landlords/landlord.module';
import { LeasesModule } from './features/leases/leases.module';
import { MaintenanceModule } from './features/maintenance/maintenance.module';
import { MarketingChatModule } from './features/marketing-chat/marketing-chat.module';
import { MediaModule } from './features/media/media.module';
import { NotificationsModule } from './features/notifications/notifications.module';
import { OnboardingModule } from './features/onboarding/onboarding.module';
import { PropertiesModule } from './features/properties/properties.module';
import { RevenuesModule } from './features/revenues/revenues.module';
import { SubscribersModule } from './features/subscribers/subscribers.module';
import { AvailabilityModule } from './features/availability/availability.module';
import { TenantsModule } from './features/tenants/tenant.module';
import { UsersModule } from './features/users/users.module';
import { SchedulerModule } from './scheduler/scheduler.module';

const enableQueues = process.env.REDIS_DISABLE !== 'true';
const queueModules = enableQueues
  ? [
      BullModule.forRoot({
        connection: {
          host: process.env.REDIS_HOST || 'localhost',
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          password: process.env.REDIS_PASSWORD,
        },
      }),
      BullBoardModule.forRoot({
        route: '/admin/queues',
        adapter: ExpressAdapter,
      }),
      BullBoardModule.forFeature({
        name: 'email',
        adapter: BullMQAdapter,
      }),
      BullBoardModule.forFeature({
        name: 'feedback-analysis',
        adapter: BullMQAdapter,
      }),
    ]
  : [];

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: 60,
          limit: 60,
        },
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, renewalConfig],
      validate: (env: Record<string, any>) => {
        if (!env.DB_URL) throw new Error('DB_URL is required');
        if (!env.MONGO_DB_NAME) throw new Error('MONGO_DB_NAME is required');
        if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');
        return env;
      },
    }),
    ...queueModules,
    CommonModule,
    AuthModule,
    ChatModule,
    EmailModule,
    UsersModule,
    LandlordModule,
    TenantsModule,
    ContractorModule,
    InvitationsModule,
    PropertiesModule,
    LeasesModule,
    RevenuesModule,
    MaintenanceModule,
    ExpensesModule,
    KPIModule,
    FeedPostsModule,
    FeedbackModule,
    SubscribersModule,
    AiChatModule,
    MarketingChatModule,
    MediaModule,
    InquiriesModule,
    NotificationsModule,
    OnboardingModule,
    AvailabilityModule,
    SchedulerModule,
    MongooseModule.forRoot(process.env.DB_URL, {
      dbName: process.env.MONGO_DB_NAME,
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    CsrfGuard,
  ],
})
export class AppModule {}
