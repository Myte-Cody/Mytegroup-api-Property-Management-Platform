import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SmsQueueService } from './sms-queue.service';
import { SmsService } from '../sms.service';

export interface SecurityAlertSmsData {
  recipientPhone: string;
  recipientName?: string;
  alertType: 'unauthorized_access' | 'password_changed' | 'suspicious_activity';
  timestamp: Date;
  ipAddress?: string;
}

export interface PaymentAlertSmsData {
  recipientPhone: string;
  recipientName: string;
  alertType: 'payment_received' | 'payment_failed' | 'payment_overdue';
  amount: number;
  propertyName?: string;
  dueDate?: Date;
}

export interface EmergencyAlertSmsData {
  recipientPhone: string;
  recipientName?: string;
  message: string;
  propertyName?: string;
  actionRequired?: string;
}

@Injectable()
export class AlertSmsService {
  private readonly logger = new Logger(AlertSmsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly smsService: SmsService,
    private readonly smsQueueService: SmsQueueService,
  ) {}

  /**
   * Send security alert SMS (high priority)
   */
  async sendSecurityAlert(
    data: SecurityAlertSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName =
        this.configService.get<string>('BRAND_NAME') || 'MYTE';

      let alertMessage = '';
      switch (data.alertType) {
        case 'unauthorized_access':
          alertMessage = 'ALERT: Unauthorized access attempt detected on your account';
          break;
        case 'password_changed':
          alertMessage = 'ALERT: Your password was changed';
          break;
        case 'suspicious_activity':
          alertMessage = 'ALERT: Suspicious activity detected on your account';
          break;
      }

      const timeInfo = new Date(data.timestamp).toLocaleString();
      const ipInfo = data.ipAddress ? ` from IP ${data.ipAddress}` : '';

      const message = data.recipientName
        ? `Hi ${data.recipientName}, ${alertMessage}${ipInfo} at ${timeInfo}. If this wasn't you, please contact us immediately. - ${brandName}`
        : `${alertMessage}${ipInfo} at ${timeInfo}. If this wasn't you, please contact us immediately. - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      // Security alerts should be sent immediately with high priority
      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions, {
          priority: 1, // High priority
          attempts: 5, // More retry attempts for security alerts
        });
        this.logger.log(
          `Security alert SMS queued (high priority) for ${data.recipientPhone}`,
        );
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(
          `Security alert SMS sent immediately to ${data.recipientPhone}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send security alert SMS to ${data.recipientPhone}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send payment alert SMS
   */
  async sendPaymentAlert(
    data: PaymentAlertSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName =
        this.configService.get<string>('BRAND_NAME') || 'MYTE';

      let message = `Hi ${data.recipientName}, `;
      const amount = `$${data.amount}`;
      const propertyInfo = data.propertyName ? ` for ${data.propertyName}` : '';

      switch (data.alertType) {
        case 'payment_received':
          message += `payment of ${amount}${propertyInfo} has been received. Thank you!`;
          break;
        case 'payment_failed':
          message += `payment of ${amount}${propertyInfo} failed. Please update your payment method.`;
          break;
        case 'payment_overdue':
          const dueDate = data.dueDate
            ? new Date(data.dueDate).toLocaleDateString()
            : '';
          message += `payment of ${amount}${propertyInfo} is overdue${dueDate ? ` (due ${dueDate})` : ''}. Please submit payment.`;
          break;
      }

      message += ` - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      if (options?.queue !== false) {
        await this.smsQueueService.queueSms(smsOptions, {
          priority: data.alertType === 'payment_received' ? 3 : 2,
        });
        this.logger.log(
          `Payment alert SMS queued for ${data.recipientPhone}`,
        );
      } else {
        await this.smsService.sendSms(smsOptions);
        this.logger.log(
          `Payment alert SMS sent immediately to ${data.recipientPhone}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send payment alert SMS to ${data.recipientPhone}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send emergency alert SMS (highest priority, immediate delivery)
   */
  async sendEmergencyAlert(
    data: EmergencyAlertSmsData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName =
        this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const propertyInfo = data.propertyName
        ? ` at ${data.propertyName}`
        : '';
      const actionInfo = data.actionRequired
        ? ` Action required: ${data.actionRequired}`
        : '';

      const message = data.recipientName
        ? `EMERGENCY ALERT ${data.recipientName}: ${data.message}${propertyInfo}.${actionInfo} - ${brandName}`
        : `EMERGENCY ALERT: ${data.message}${propertyInfo}.${actionInfo} - ${brandName}`;

      const smsOptions = {
        to: data.recipientPhone,
        body: message,
      };

      // Emergency alerts should typically be sent immediately
      if (options?.queue === true) {
        await this.smsQueueService.queueSms(smsOptions, {
          priority: 0, // Highest priority
          attempts: 5,
          backoff: { type: 'fixed', delay: 1000 }, // Quick retries
        });
        this.logger.log(
          `Emergency alert SMS queued (highest priority) for ${data.recipientPhone}`,
        );
      } else {
        // Default to immediate send for emergencies
        await this.smsService.sendSms(smsOptions);
        this.logger.log(
          `Emergency alert SMS sent immediately to ${data.recipientPhone}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send emergency alert SMS to ${data.recipientPhone}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send verification code SMS
   */
  async sendVerificationCode(
    recipientPhone: string,
    code: string,
    expiryMinutes: number = 10,
  ): Promise<void> {
    try {
      const brandName =
        this.configService.get<string>('BRAND_NAME') || 'MYTE';

      const message = `Your ${brandName} verification code is: ${code}. This code expires in ${expiryMinutes} minutes. Do not share this code with anyone.`;

      const smsOptions = {
        to: recipientPhone,
        body: message,
      };

      // Verification codes should be sent immediately
      await this.smsService.sendSms(smsOptions);
      this.logger.log(
        `Verification code SMS sent immediately to ${recipientPhone}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send verification code SMS to ${recipientPhone}`,
        error,
      );
      throw error;
    }
  }
}
