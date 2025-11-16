import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

export interface ContactRequestEmailData {
  recipientName: string;
  recipientEmail: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  propertyName: string;
  unitIdentifier?: string;
  message?: string;
  submittedAt: Date;
}

export interface VisitRequestEmailData {
  recipientName: string;
  recipientEmail: string;
  leadName: string;
  leadEmail: string;
  leadPhone?: string;
  propertyName: string;
  unitIdentifier?: string;
  preferredDate?: Date;
  message?: string;
  submittedAt: Date;
}

@Injectable()
export class InquiryEmailService {
  private readonly logger = new Logger(InquiryEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  /**
   * Send contact request email notification
   */
  async sendContactRequestEmail(
    data: ContactRequestEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'contact-request',
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
        this.logger.log(`Contact request email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Contact request email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} contact request email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }

  /**
   * Send visit request email notification
   */
  async sendVisitRequestEmail(
    data: VisitRequestEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Prepare template context
      const context = {
        ...data,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'visit-request',
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
        this.logger.log(`Visit request email queued successfully for ${data.recipientEmail}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Visit request email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} visit request email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }
}
