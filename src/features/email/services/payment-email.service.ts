import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

export interface PaymentReminderEmailData {
  recipientName: string;
  recipientEmail: string;
  propertyName: string;
  unitIdentifier: string;
  amount: number;
  dueDate: Date;
  periodStartDate: Date;
  periodEndDate: Date;
}

export interface PaymentOverdueEmailData {
  recipientName: string;
  recipientEmail: string;
  propertyName: string;
  unitIdentifier: string;
  amount: number;
  dueDate: Date;
  periodStartDate: Date;
  periodEndDate: Date;
  daysLate: number;
}

export interface PaymentConfirmationEmailData {
  recipientName: string;
  recipientEmail: string;
  propertyName: string;
  unitIdentifier: string;
  amount: number;
  paymentDate: Date;
  periodStartDate: Date;
  periodEndDate: Date;
  transactionId: string;
  paymentMethod: string;
  paymentReference?: string;
  dashboardUrl?: string;
}

@Injectable()
export class PaymentEmailService {
  private readonly logger = new Logger(PaymentEmailService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('app.frontendUrl') || 'http://localhost:3000';
  }

  /**
   * Send payment reminder email notification
   * @param data Payment reminder data
   * @param options Email options
   */
  async sendPaymentReminderEmail(
    data: PaymentReminderEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Add current year for copyright in footer
      const context = {
        ...data,
        currentYear: new Date().getFullYear(),
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'payment-reminder',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject: `Payment Reminder: Rent Due in 7 Days`,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Payment reminder email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Payment reminder email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} payment reminder email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send payment overdue email notification
   * @param data Payment overdue data
   * @param options Email options
   */
  async sendPaymentOverdueEmail(
    data: PaymentOverdueEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Add current year for copyright in footer
      const context = {
        ...data,
        currentYear: new Date().getFullYear(),
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'payment-overdue',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject: `URGENT: Payment Overdue Notice - ${data.daysLate} Days Late`,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Payment overdue email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Payment overdue email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} payment overdue email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send payment confirmation email notification
   * @param data Payment confirmation data
   * @param options Email options
   */
  async sendPaymentConfirmationEmail(
    data: PaymentConfirmationEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Add dashboard URL if not provided
      const dashboardUrl = data.dashboardUrl || `${this.frontendUrl}/tenant/payments`;

      // Add current year for copyright in footer
      const context = {
        ...data,
        dashboardUrl,
        currentYear: new Date().getFullYear(),
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'payment-confirmation',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject: `Payment Confirmation - Receipt #${data.transactionId}`,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(
          `Payment confirmation email queued successfully for ${data.recipientEmail}`,
        );
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Payment confirmation email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} payment confirmation email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send bulk payment reminder emails
   * @param dataList List of payment reminder data
   */
  async sendBulkPaymentReminders(dataList: PaymentReminderEmailData[]): Promise<void> {
    try {
      // Compile all templates first
      const emailOptions = await Promise.all(
        dataList.map(async (data) => {
          const context = {
            ...data,
            currentYear: new Date().getFullYear(),
          };

          const { html, subject, text } = await this.templateService.compileTemplate(
            'payment-reminder',
            context,
          );

          return {
            to: data.recipientEmail,
            subject: `Payment Reminder: Rent Due in 7 Days`,
            html,
            text,
          };
        }),
      );

      // Queue all emails
      await this.emailQueueService.queueBulkEmails(emailOptions);
      this.logger.log(`Queued ${dataList.length} payment reminder emails`);
    } catch (error) {
      this.logger.error('Failed to send bulk payment reminder emails', error);
      throw error;
    }
  }

  /**
   * Send bulk payment overdue emails
   * @param dataList List of payment overdue data
   */
  async sendBulkPaymentOverdueNotices(dataList: PaymentOverdueEmailData[]): Promise<void> {
    try {
      // Compile all templates first
      const emailOptions = await Promise.all(
        dataList.map(async (data) => {
          const context = {
            ...data,
            currentYear: new Date().getFullYear(),
          };

          const { html, subject, text } = await this.templateService.compileTemplate(
            'payment-overdue',
            context,
          );

          return {
            to: data.recipientEmail,
            subject: `URGENT: Payment Overdue Notice - ${data.daysLate} Days Late`,
            html,
            text,
          };
        }),
      );

      // Queue all emails
      await this.emailQueueService.queueBulkEmails(emailOptions);
      this.logger.log(`Queued ${dataList.length} payment overdue emails`);
    } catch (error) {
      this.logger.error('Failed to send bulk payment overdue emails', error);
      throw error;
    }
  }
}
