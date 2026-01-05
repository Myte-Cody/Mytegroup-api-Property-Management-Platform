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
