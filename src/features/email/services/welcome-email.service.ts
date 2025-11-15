import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

@Injectable()
export class WelcomeEmailService {
  private readonly logger = new Logger(WelcomeEmailService.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  async sendWelcomeEmail(
    to: string,
    userName: string,
    dashboardUrl?: string,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      // Always compile template first
      const context = { userName, dashboardUrl };
      const { html, subject, text } = await this.templateService.compileTemplate(
        'welcome',
        context,
      );
      const emailOptions = { to, subject, html, text };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Welcome email queued successfully for ${to}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Welcome email sent successfully to ${to}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} welcome email to ${to}`,
        error,
      );
      throw error;
    }
  }
}
