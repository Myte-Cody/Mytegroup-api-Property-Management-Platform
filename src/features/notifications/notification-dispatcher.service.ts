import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@shared/notification-types';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationsService } from './notifications.service';

export interface SendNotificationParams {
  userId: string;
  notificationType: NotificationType;
  title: string;
  content: string;
  actionUrl?: string;
}

export interface NotificationChannelStatus {
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

@Injectable()
export class NotificationDispatcherService {
  private readonly logger = new Logger(NotificationDispatcherService.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly preferencesService: NotificationPreferencesService,
  ) {}

  /**
   * Send a notification respecting user preferences for in-app notifications
   * Returns which other channels (email, SMS) are enabled
   */
  async sendNotification(params: SendNotificationParams): Promise<NotificationChannelStatus> {
    const { userId, notificationType, title, content, actionUrl } = params;

    // Check preferences for all channels
    const [shouldSendInApp, shouldSendEmail, shouldSendSms] = await Promise.all([
      this.preferencesService.shouldSendNotification(
        userId,
        notificationType,
        NotificationChannel.IN_APP,
      ),
      this.preferencesService.shouldSendNotification(
        userId,
        notificationType,
        NotificationChannel.EMAIL,
      ),
      this.preferencesService.shouldSendNotification(
        userId,
        notificationType,
        NotificationChannel.SMS,
      ),
    ]);

    // Send in-app notification if enabled
    if (shouldSendInApp) {
      try {
        await this.notificationsService.createNotification(userId, title, content, actionUrl);
        this.logger.debug(
          `In-app notification sent to user ${userId} for type ${notificationType}`,
        );
      } catch (error) {
        this.logger.error(`Failed to send in-app notification to user ${userId}`, error);
      }
    } else {
      this.logger.debug(`In-app notification skipped for user ${userId} - disabled in preferences`);
    }

    // Return status for other channels
    return {
      inApp: shouldSendInApp,
      email: shouldSendEmail,
      sms: shouldSendSms,
    };
  }

  /**
   * Check if a notification should be sent on a specific channel
   * Useful for checking before sending email or SMS
   */
  async shouldNotify(
    userId: string,
    notificationType: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    return this.preferencesService.shouldSendNotification(userId, notificationType, channel);
  }

  /**
   * Check which channels are enabled for a notification
   */
  async getEnabledChannels(
    userId: string,
    notificationType: NotificationType,
  ): Promise<NotificationChannelStatus> {
    const [inApp, email, sms] = await Promise.all([
      this.preferencesService.shouldSendNotification(
        userId,
        notificationType,
        NotificationChannel.IN_APP,
      ),
      this.preferencesService.shouldSendNotification(
        userId,
        notificationType,
        NotificationChannel.EMAIL,
      ),
      this.preferencesService.shouldSendNotification(
        userId,
        notificationType,
        NotificationChannel.SMS,
      ),
    ]);

    return { inApp, email, sms };
  }

  /**
   * Send in-app notification only (convenience method)
   */
  async sendInAppNotification(
    userId: string,
    notificationType: NotificationType,
    title: string,
    content: string,
    actionUrl?: string,
  ): Promise<boolean> {
    const shouldSend = await this.preferencesService.shouldSendNotification(
      userId,
      notificationType,
      NotificationChannel.IN_APP,
    );

    if (shouldSend) {
      try {
        await this.notificationsService.createNotification(userId, title, content, actionUrl);
        return true;
      } catch (error) {
        this.logger.error(`Failed to send in-app notification to user ${userId}`, error);
        return false;
      }
    }

    this.logger.debug(`In-app notification skipped for user ${userId} - disabled in preferences`);
    return false;
  }
}
