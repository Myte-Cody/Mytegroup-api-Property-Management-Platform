import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailQueueProcessor } from './processors/email-queue.processor';
import { AuthEmailService } from './services/auth-email.service';
import { EmailQueueService } from './services/email-queue.service';
import { InvitationEmailService } from './services/invitation-email.service';
import { LeaseEmailService } from './services/lease-email.service';
import { TemplateService } from './services/template.service';
import { WelcomeEmailService } from './services/welcome-email.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({
      name: 'email',
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
  ],
  providers: [
    EmailService,
    TemplateService,
    EmailQueueService,
    WelcomeEmailService,
    AuthEmailService,
    InvitationEmailService,
    LeaseEmailService,
    EmailQueueProcessor,
  ],
  exports: [
    EmailService,
    TemplateService,
    EmailQueueService,
    WelcomeEmailService,
    AuthEmailService,
    InvitationEmailService,
    LeaseEmailService,
  ],
})
export class EmailModule {}
