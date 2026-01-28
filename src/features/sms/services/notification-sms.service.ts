import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsService } from '../sms.service';
import { SmsQueueService } from './sms-queue.service';

export interface NotificationSmsData {
  recipientPhone: string;
  recipientName?: string;
  message: string;
  userId?: string;
  tenantId?: string;
}

export interface MaintenanceUpdateSmsData {
  recipientPhone: string;
  recipientName: string;
  ticketNumber: string;
  status: string;
  propertyName: string;
  unitIdentifier?: string;
}

export interface LeaseReminderSmsData {
  recipientPhone: string;
  recipientName: string;
  reminderType: 'rent_due' | 'lease_expiring' | 'inspection';
  propertyName: string;
  dueDate?: Date;
  amount?: number;
}

export interface LeaseNotificationSmsData {
  recipientPhone: string;
  recipientName: string;
  propertyName: string;
  unitIdentifier: string;
  leaseEventType: 'activated' | 'terminated' | 'renewed' | 'expiring' | 'terms_updated';
  additionalInfo?: {
    moveOutDate?: Date;
    expirationDate?: Date;
    newEndDate?: Date;
    daysRemaining?: number;
  };
}

@Injectable()
export class NotificationSmsService {
  private readonly logger = new Logger(NotificationSmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly smsQueueService: SmsQueueService,
  ) {}

  /**
   * Send a generic notification SMS
   */
  async sendNotificationSms(
    data: NotificationSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const message = data.recipientName
        ? `Hi ${data.recipientName}, ${data.message} - ${brandName}`
        : `${data.message} - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Notification SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Notification SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send notification SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send maintenance ticket update SMS
   */
  async sendMaintenanceUpdateSms(
    data: MaintenanceUpdateSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const unitInfo = data.unitIdentifier ? ` for unit ${data.unitIdentifier}` : '';

      const message = `Hi ${data.recipientName}, maintenance ticket #${data.ticketNumber}${unitInfo} at ${data.propertyName} is now ${data.status}. - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Maintenance update SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Maintenance update SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send maintenance update SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send lease reminder SMS
   */
  async sendLeaseReminderSms(
    data: LeaseReminderSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      let message = `Hi ${data.recipientName}, `;

      switch (data.reminderType) {
        case 'rent_due':
          const dueDate = data.dueDate ? new Date(data.dueDate).toLocaleDateString() : 'soon';
          const amount = data.amount ? `$${data.amount}` : 'your rent';
          message += `reminder: ${amount} is due ${dueDate} for ${data.propertyName}.`;
          break;
        case 'lease_expiring':
          message += `your lease at ${data.propertyName} is expiring soon. Please contact us to discuss renewal.`;
          break;
        case 'inspection':
          const inspectionDate = data.dueDate
            ? new Date(data.dueDate).toLocaleDateString()
            : 'soon';
          message += `property inspection scheduled for ${inspectionDate} at ${data.propertyName}.`;
          break;
        default:
          message += `reminder for ${data.propertyName}.`;
      }

      message += ` - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Lease reminder SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Lease reminder SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send lease reminder SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send lease activated SMS
   */
  async sendLeaseActivatedSms(
    data: LeaseNotificationSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const message = `Hi ${data.recipientName}, your lease for ${data.propertyName} - Unit ${data.unitIdentifier} has been activated. Welcome to your new home! - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Lease activated SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Lease activated SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send lease activated SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send lease terminated SMS
   */
  async sendLeaseTerminatedSms(
    data: LeaseNotificationSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      let message = `Hi ${data.recipientName}, your lease for ${data.propertyName} - Unit ${data.unitIdentifier} has been terminated.`;

      if (data.additionalInfo?.moveOutDate) {
        const moveOutDateStr = new Date(data.additionalInfo.moveOutDate).toLocaleDateString();
        message += ` Move-out date: ${moveOutDateStr}.`;
      }

      message += ` Please check your email for details. - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Lease terminated SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Lease terminated SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send lease terminated SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send lease renewal SMS
   */
  async sendLeaseRenewalSms(
    data: LeaseNotificationSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      let message = `Hi ${data.recipientName}, your lease for ${data.propertyName} - Unit ${data.unitIdentifier} has been renewed.`;

      if (data.additionalInfo?.newEndDate) {
        const newEndDateStr = new Date(data.additionalInfo.newEndDate).toLocaleDateString();
        message += ` New end date: ${newEndDateStr}.`;
      }

      message += ` Check your email for updated terms. - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Lease renewal SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Lease renewal SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send lease renewal SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send lease expiring soon SMS
   */
  async sendLeaseExpiringSoonSms(
    data: LeaseNotificationSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      let message = `Hi ${data.recipientName}, your lease for ${data.propertyName} - Unit ${data.unitIdentifier}`;

      if (data.additionalInfo?.daysRemaining && data.additionalInfo.daysRemaining > 0) {
        message += ` expires in ${data.additionalInfo.daysRemaining} days.`;
      } else {
        message += ` has expired.`;
      }

      message += ` Please contact us to discuss renewal options. - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Lease expiring soon SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Lease expiring soon SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send lease expiring soon SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send lease terms updated SMS
   */
  async sendLeaseTermsUpdatedSms(
    data: LeaseNotificationSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const message = `Hi ${data.recipientName}, the terms for your lease at ${data.propertyName} - Unit ${data.unitIdentifier} have been updated. Please check your email for details. - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions);
        this.logger.log(`Lease terms updated SMS queued for ${data.recipientPhone}`);
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(`Lease terms updated SMS sent immediately to ${data.recipientPhone}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send lease terms updated SMS to ${data.recipientPhone}`, error);
      throw error;
    }
  }

  /**
   * Send bulk notification SMS messages
   */
  async sendBulkNotificationSms(
    recipients: Array<{ phone: string; name?: string; message: string }>,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const smsMessages = recipients.map((recipient) => ({
        to: recipient.phone,
        body: recipient.name
          ? `Hi ${recipient.name}, ${recipient.message} - ${brandName}`
          : `${recipient.message} - ${brandName}`,
      }));

      if (options?.queue !== false) {
        await this.smsQueueService.queueBulkSms(smsMessages);
        this.logger.log(`Bulk notification SMS queued for ${recipients.length} recipients`);
      } else {
        for (const smsOptions of smsMessages) {
          await this.smsService.sendSms(smsOptions);
        }
        this.logger.log(
          `Bulk notification SMS sent immediately to ${recipients.length} recipients`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to send bulk notification SMS`, error);
      throw error;
    }
  }
}
