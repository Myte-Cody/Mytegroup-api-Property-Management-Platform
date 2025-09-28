import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

export interface LeaseActivatedEmailData {
  recipientName: string;
  recipientEmail: string;
  isTenant: boolean;
  propertyName: string;
  unitIdentifier: string;
  propertyAddress: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  monthlyRent: number;
}

export interface LeaseRenewalEmailData {
  recipientName: string;
  recipientEmail: string;
  isAutoRenewal: boolean;
  propertyName: string;
  unitIdentifier: string;
  currentLeaseEndDate: Date;
  newLeaseStartDate: Date;
  newLeaseEndDate: Date;
  currentMonthlyRent: number;
  newMonthlyRent?: number;
  renewalDate?: Date;
}

export interface LeaseTerminationEmailData {
  recipientName: string;
  recipientEmail: string;
  isTenant: boolean;
  propertyName: string;
  unitIdentifier: string;
  propertyAddress: string;
  originalLeaseEndDate: Date;
  terminationDate: Date;
  terminationReason: string;
  moveOutDate: Date;
  additionalNotes?: string;
}

export interface LeaseExpirationWarningEmailData {
  recipientName: string;
  recipientEmail: string;
  isTenant: boolean;
  propertyName: string;
  unitIdentifier: string;
  propertyAddress: string;
  leaseStartDate: Date;
  leaseEndDate: Date;
  daysRemaining: number;
}

@Injectable()
export class LeaseEmailService {
  private readonly logger = new Logger(LeaseEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  /**
   * Send lease activated email notification
   */
  async sendLeaseActivatedEmail(
    data: LeaseActivatedEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'lease-activated',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Lease activated email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Lease activated email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} lease activated email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send lease renewal email notification
   */
  async sendLeaseRenewalEmail(
    data: LeaseRenewalEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'lease-renewal',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Lease renewal email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Lease renewal email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} lease renewal email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send lease termination email notification
   */
  async sendLeaseTerminationEmail(
    data: LeaseTerminationEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'lease-termination',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Lease termination email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Lease termination email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} lease termination email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send lease expiration warning email notification
   */
  async sendLeaseExpirationWarningEmail(
    data: LeaseExpirationWarningEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'lease-expiration-warning',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(
          `Lease expiration warning email queued successfully for ${data.recipientEmail}`,
        );
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(
          `Lease expiration warning email sent successfully to ${data.recipientEmail}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} lease expiration warning email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send bulk lease expiration warning emails
   * Useful for scheduled tasks that send warnings to multiple users
   */
  async sendBulkLeaseExpirationWarnings(
    dataList: LeaseExpirationWarningEmailData[],
  ): Promise<void> {
    try {
      // Compile all templates first
      const emailOptions = await Promise.all(
        dataList.map(async (data) => {
          const context = {
            ...data,
          };

          const { html, subject, text } = await this.templateService.compileTemplate(
            'lease-expiration-warning',
            context,
          );

          return {
            to: data.recipientEmail,
            subject,
            html,
            text,
          };
        }),
      );

      await this.emailQueueService.queueBulkEmails(emailOptions);
      this.logger.log(
        `Bulk lease expiration warning emails queued for ${dataList.length} recipients`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue bulk lease expiration warning emails`, error);
      throw error;
    }
  }
}
