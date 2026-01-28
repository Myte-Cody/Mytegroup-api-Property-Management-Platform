import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@shared/notification-types';
import { LeaseEmailService } from '../email/services/lease-email.service';
import { MaintenanceEmailService } from '../email/services/maintenance-email.service';
import { NotificationSmsService } from '../sms/services/notification-sms.service';
import {
  LeaseActivatedData,
  LeaseExpiringSoonData,
  LeaseRenewalReminderData,
  LeaseTerminatedData,
  LeaseTermsUpdatedData,
  MaintenanceNewRequestData,
  MaintenanceStatusChangedData,
  NotifyUserRequest,
  NotifyUserResult,
} from './interfaces/notification-payload.interface';
import { NotificationContentMapper } from './mappers/notification-content.mapper';
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
    private readonly contentMapper: NotificationContentMapper,
    private readonly leaseEmailService: LeaseEmailService,
    private readonly maintenanceEmailService: MaintenanceEmailService,
    private readonly notificationSmsService: NotificationSmsService,
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

  /**
   * Unified method to send notifications across all channels (in-app, email, SMS)
   * based on user preferences. This replaces the fragmented 3-step notification pattern.
   */
  async notifyUser(request: NotifyUserRequest): Promise<NotifyUserResult> {
    const { userId, notificationType, data, actionUrl } = request;

    // Initialize result
    const result: NotifyUserResult = {
      success: true,
      channels: {
        inApp: { enabled: false, sent: false },
        email: { enabled: false, sent: false },
        sms: { enabled: false, sent: false },
      },
    };

    // Check preferences for all channels in parallel
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

    result.channels.inApp.enabled = shouldSendInApp;
    result.channels.email.enabled = shouldSendEmail;
    result.channels.sms.enabled = shouldSendSms;

    // Send notifications in parallel (each channel is independent)
    const promises: Promise<void>[] = [];

    // In-App Notification
    if (shouldSendInApp) {
      promises.push(this.sendInAppChannel(userId, notificationType, data, actionUrl, result));
    }

    // Email Notification
    if (shouldSendEmail && data.recipientEmail) {
      promises.push(this.sendEmailChannel(notificationType, data, result));
    }

    // SMS Notification
    if (shouldSendSms && data.recipientPhone) {
      promises.push(this.sendSmsChannel(notificationType, data, result));
    }

    // Wait for all channels to complete
    await Promise.all(promises);

    // Check if any channel failed
    result.success =
      (!result.channels.inApp.enabled || result.channels.inApp.sent) &&
      (!result.channels.email.enabled || !data.recipientEmail || result.channels.email.sent) &&
      (!result.channels.sms.enabled || !data.recipientPhone || result.channels.sms.sent);

    return result;
  }

  private async sendInAppChannel(
    userId: string,
    notificationType: NotificationType,
    data: any,
    actionUrl: string | undefined,
    result: NotifyUserResult,
  ): Promise<void> {
    try {
      const inAppContent = this.contentMapper.getInAppContent(notificationType, data, actionUrl);
      await this.notificationsService.createNotification(
        userId,
        inAppContent.title,
        inAppContent.message,
        inAppContent.actionUrl,
      );
      result.channels.inApp.sent = true;
      this.logger.debug(`In-app notification sent to user ${userId} for type ${notificationType}`);
    } catch (error) {
      result.channels.inApp.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send in-app notification to user ${userId}`, error);
    }
  }

  private async sendEmailChannel(
    notificationType: NotificationType,
    data: any,
    result: NotifyUserResult,
  ): Promise<void> {
    try {
      await this.sendEmailByType(notificationType, data);
      result.channels.email.sent = true;
      this.logger.debug(`Email notification queued for ${data.recipientEmail}`);
    } catch (error) {
      result.channels.email.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send email to ${data.recipientEmail}`, error);
    }
  }

  private async sendSmsChannel(
    notificationType: NotificationType,
    data: any,
    result: NotifyUserResult,
  ): Promise<void> {
    try {
      await this.sendSmsByType(notificationType, data);
      result.channels.sms.sent = true;
      this.logger.debug(`SMS notification queued for ${data.recipientPhone}`);
    } catch (error) {
      result.channels.sms.error = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send SMS to ${data.recipientPhone}`, error);
    }
  }

  private async sendEmailByType(notificationType: NotificationType, data: any): Promise<void> {
    switch (notificationType) {
      // ========== LEASE EMAILS ==========
      case NotificationType.LEASE_ACTIVATED: {
        const leaseData = data as LeaseActivatedData;
        await this.leaseEmailService.sendLeaseActivatedEmail(
          {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail!,
            isTenant: leaseData.isTenant,
            propertyName: leaseData.propertyName!,
            unitIdentifier: leaseData.unitIdentifier!,
            propertyAddress: leaseData.propertyAddress,
            leaseStartDate: leaseData.leaseStartDate,
            leaseEndDate: leaseData.leaseEndDate,
            monthlyRent: leaseData.monthlyRent,
          },
          { queue: true },
        );
        break;
      }

      case NotificationType.LEASE_TERMINATED: {
        const leaseData = data as LeaseTerminatedData;
        await this.leaseEmailService.sendLeaseTerminationEmail(
          {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail!,
            isTenant: leaseData.isTenant,
            propertyName: leaseData.propertyName!,
            unitIdentifier: leaseData.unitIdentifier!,
            propertyAddress: leaseData.propertyAddress,
            originalLeaseEndDate: leaseData.originalLeaseEndDate,
            terminationDate: leaseData.terminationDate,
            terminationReason: leaseData.terminationReason,
            moveOutDate: leaseData.moveOutDate,
            additionalNotes: leaseData.additionalNotes,
          },
          { queue: true },
        );
        break;
      }

      case NotificationType.LEASE_RENEWAL_REMINDER: {
        const leaseData = data as LeaseRenewalReminderData;
        await this.leaseEmailService.sendLeaseRenewalEmail(
          {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail!,
            isAutoRenewal: leaseData.isAutoRenewal,
            propertyName: leaseData.propertyName!,
            unitIdentifier: leaseData.unitIdentifier!,
            currentLeaseEndDate: leaseData.currentLeaseEndDate,
            newLeaseStartDate: leaseData.newLeaseStartDate,
            newLeaseEndDate: leaseData.newLeaseEndDate,
            currentMonthlyRent: leaseData.currentMonthlyRent,
            newMonthlyRent: leaseData.newMonthlyRent,
            renewalDate: leaseData.renewalDate,
          },
          { queue: true },
        );
        break;
      }

      case NotificationType.LEASE_EXPIRING_SOON: {
        const leaseData = data as LeaseExpiringSoonData;
        await this.leaseEmailService.sendLeaseExpirationWarningEmail(
          {
            recipientName: leaseData.recipientName,
            recipientEmail: leaseData.recipientEmail!,
            isTenant: leaseData.isTenant,
            propertyName: leaseData.propertyName!,
            unitIdentifier: leaseData.unitIdentifier!,
            propertyAddress: leaseData.propertyAddress,
            leaseStartDate: leaseData.leaseStartDate,
            leaseEndDate: leaseData.leaseEndDate,
            daysRemaining: leaseData.daysRemaining,
          },
          { queue: true },
        );
        break;
      }

      // ========== MAINTENANCE EMAILS ==========
      case NotificationType.MAINTENANCE_NEW_REQUEST: {
        const maintenanceData = data as MaintenanceNewRequestData;
        await this.maintenanceEmailService.sendTicketCreatedEmail(
          {
            recipientName: maintenanceData.recipientName,
            recipientEmail: maintenanceData.recipientEmail!,
            tenantName: maintenanceData.tenantName,
            ticketNumber: maintenanceData.ticketNumber,
            ticketTitle: maintenanceData.ticketTitle,
            priority: maintenanceData.priority,
            category: maintenanceData.category,
            propertyName: maintenanceData.propertyName!,
            unitIdentifier: maintenanceData.unitIdentifier,
            description: maintenanceData.description,
            createdAt: maintenanceData.createdAt,
          },
          { queue: true },
        );
        break;
      }

      case NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        await this.maintenanceEmailService.sendTicketCompletedEmail(
          {
            recipientName: maintenanceData.recipientName,
            recipientEmail: maintenanceData.recipientEmail!,
            contractorName: maintenanceData.changedBy || 'Contractor',
            ticketNumber: maintenanceData.ticketNumber,
            ticketTitle: maintenanceData.ticketTitle,
            category: 'Maintenance',
            propertyName: maintenanceData.propertyName!,
            unitIdentifier: maintenanceData.unitIdentifier,
            completedAt: new Date(),
          },
          { queue: true },
        );
        break;
      }

      default:
        this.logger.debug(
          `No email template configured for notification type: ${notificationType}`,
        );
    }
  }

  private async sendSmsByType(notificationType: NotificationType, data: any): Promise<void> {
    const smsContent = this.contentMapper.getSmsContent(notificationType, data);

    if (!smsContent) {
      this.logger.debug(`No SMS content configured for notification type: ${notificationType}`);
      return;
    }

    switch (notificationType) {
      // ========== LEASE SMS ==========
      case NotificationType.LEASE_ACTIVATED: {
        const leaseData = data as LeaseActivatedData;
        await this.notificationSmsService.sendLeaseActivatedSms({
          recipientPhone: leaseData.recipientPhone!,
          recipientName: leaseData.recipientName,
          propertyName: leaseData.propertyName!,
          unitIdentifier: leaseData.unitIdentifier!,
          leaseEventType: 'activated',
        });
        break;
      }

      case NotificationType.LEASE_TERMINATED: {
        const leaseData = data as LeaseTerminatedData;
        await this.notificationSmsService.sendLeaseTerminatedSms({
          recipientPhone: leaseData.recipientPhone!,
          recipientName: leaseData.recipientName,
          propertyName: leaseData.propertyName!,
          unitIdentifier: leaseData.unitIdentifier!,
          leaseEventType: 'terminated',
          additionalInfo: {
            moveOutDate: leaseData.moveOutDate,
          },
        });
        break;
      }

      case NotificationType.LEASE_RENEWAL_REMINDER: {
        const leaseData = data as LeaseRenewalReminderData;
        await this.notificationSmsService.sendLeaseRenewalSms({
          recipientPhone: leaseData.recipientPhone!,
          recipientName: leaseData.recipientName,
          propertyName: leaseData.propertyName!,
          unitIdentifier: leaseData.unitIdentifier!,
          leaseEventType: 'renewed',
          additionalInfo: {
            newEndDate: leaseData.newLeaseEndDate,
          },
        });
        break;
      }

      case NotificationType.LEASE_EXPIRING_SOON: {
        const leaseData = data as LeaseExpiringSoonData;
        await this.notificationSmsService.sendLeaseExpiringSoonSms({
          recipientPhone: leaseData.recipientPhone!,
          recipientName: leaseData.recipientName,
          propertyName: leaseData.propertyName!,
          unitIdentifier: leaseData.unitIdentifier!,
          leaseEventType: 'expiring',
          additionalInfo: {
            daysRemaining: leaseData.daysRemaining,
          },
        });
        break;
      }

      case NotificationType.LEASE_TERMS_UPDATED: {
        const leaseData = data as LeaseTermsUpdatedData;
        await this.notificationSmsService.sendLeaseTermsUpdatedSms({
          recipientPhone: leaseData.recipientPhone!,
          recipientName: leaseData.recipientName,
          propertyName: leaseData.propertyName!,
          unitIdentifier: leaseData.unitIdentifier!,
          leaseEventType: 'terms_updated',
        });
        break;
      }

      // ========== MAINTENANCE SMS ==========
      case NotificationType.MAINTENANCE_STATUS_CHANGED_IN_PROGRESS:
      case NotificationType.MAINTENANCE_STATUS_CHANGED_COMPLETED:
      case NotificationType.MAINTENANCE_STATUS_CHANGED_CLOSED: {
        const maintenanceData = data as MaintenanceStatusChangedData;
        await this.notificationSmsService.sendMaintenanceUpdateSms({
          recipientPhone: maintenanceData.recipientPhone!,
          recipientName: maintenanceData.recipientName,
          ticketNumber: maintenanceData.ticketNumber,
          status: maintenanceData.status,
          propertyName: maintenanceData.propertyName!,
          unitIdentifier: maintenanceData.unitIdentifier,
        });
        break;
      }

      default:
        // Use generic notification SMS for types without specific handlers
        await this.notificationSmsService.sendNotificationSms({
          recipientPhone: data.recipientPhone,
          recipientName: data.recipientName,
          message: smsContent.message,
        });
    }
  }
}
