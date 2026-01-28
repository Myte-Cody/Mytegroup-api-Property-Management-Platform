import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EmailModule } from '../email/email.module';
import { SmsModule } from '../sms/sms.module';
import { NotificationContentMapper } from './mappers/notification-content.mapper';
import { NotificationDispatcherService } from './notification-dispatcher.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import {
  NotificationPreference,
  NotificationPreferenceSchema,
} from './schemas/notification-preference.schema';
import { Notification, NotificationSchema } from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
    ]),
    EmailModule,
    SmsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsGateway,
    NotificationPreferencesService,
    NotificationDispatcherService,
    NotificationContentMapper,
  ],
  exports: [
    NotificationsService,
    NotificationsGateway,
    NotificationPreferencesService,
    NotificationDispatcherService,
    NotificationContentMapper,
  ],
})
export class NotificationsModule {}
