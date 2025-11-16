import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

export interface TicketCreatedEmailData {
  recipientName: string;
  recipientEmail: string;
  tenantName: string;
  ticketNumber: string;
  ticketTitle: string;
  priority: string;
  category: string;
  propertyName: string;
  unitIdentifier?: string;
  description?: string;
  createdAt: Date;
}

export interface TicketCompletedEmailData {
  recipientName: string;
  recipientEmail: string;
  contractorName: string;
  ticketNumber: string;
  ticketTitle: string;
  category: string;
  propertyName: string;
  unitIdentifier?: string;
  completedAt: Date;
  cost?: number;
  completionNotes?: string;
}

export interface InvoiceUploadedEmailData {
  recipientName: string;
  recipientEmail: string;
  contractorName: string;
  entityReference: string;
  invoiceNumber: string;
  amount?: number;
  uploadedAt: Date;
}

@Injectable()
export class MaintenanceEmailService {
  private readonly logger = new Logger(MaintenanceEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  /**
   * Send ticket created email notification
   */
  async sendTicketCreatedEmail(
    data: TicketCreatedEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'ticket-created',
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
        this.logger.log(`Ticket created email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Ticket created email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} ticket created email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send ticket completed email notification
   */
  async sendTicketCompletedEmail(
    data: TicketCompletedEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'ticket-completed',
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
        this.logger.log(`Ticket completed email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Ticket completed email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} ticket completed email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send invoice uploaded email notification
   */
  async sendInvoiceUploadedEmail(
    data: InvoiceUploadedEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'invoice-uploaded',
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
        this.logger.log(`Invoice uploaded email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Invoice uploaded email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} invoice uploaded email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }
}
