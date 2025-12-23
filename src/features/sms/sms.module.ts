import { BullModule } from '@nestjs/bullmq';
import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { SmsQueueProcessor } from './processors/sms-queue.processor';
import { SmsMessage, SmsMessageSchema } from './schemas/sms-message.schema';
import { AlertSmsService } from './services/alert-sms.service';
import { NotificationSmsService } from './services/notification-sms.service';
import { SmsQueueService } from './services/sms-queue.service';
import { SmsService } from './sms.service';

const enableQueues = process.env.REDIS_DISABLE !== 'true';

@Global()
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: SmsMessage.name, schema: SmsMessageSchema },
    ]),
    ...(enableQueues
      ? [
          BullModule.registerQueue({
            name: 'sms',
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
  ],
  providers: [
    SmsService,
    SmsQueueService,
    NotificationSmsService,
    AlertSmsService,
    ...(enableQueues ? [SmsQueueProcessor] : []),
  ],
  exports: [
    SmsService,
    SmsQueueService,
    NotificationSmsService,
    AlertSmsService,
  ],
})
export class SmsModule {}
