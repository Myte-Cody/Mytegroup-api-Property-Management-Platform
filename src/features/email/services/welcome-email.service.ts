import { Injectable, Logger } from '@nestjs/common';
import { EmailService } from '../email.service';
import { TemplateService } from './template.service';
import { EmailQueueService } from './email-queue.service';

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
    options?: { queue?: boolean }
  ): Promise<void> {
    try {
      // Always compile template first
      const context = { userName, dashboardUrl };
      const { html, subject, text } = await this.templateService.compileTemplate('welcome', context);
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
      this.logger.error(`Failed to ${options?.queue ? 'queue' : 'send'} welcome email to ${to}`, error);
      throw error;
    }
  }

  async sendBulkWelcomeEmails(users: Array<{ email: string; name: string; dashboardUrl?: string }>): Promise<void> {
    try {
      // Compile all templates first
      const emailOptions = await Promise.all(
        users.map(async (user) => {
          const context = { userName: user.name, dashboardUrl: user.dashboardUrl };
          const { html, subject, text } = await this.templateService.compileTemplate('welcome', context);
          return { to: user.email, subject, html, text };
        })
      );

      await this.emailQueueService.queueBulkEmails(emailOptions);
      this.logger.log(`Bulk welcome emails queued for ${users.length} users`);
    } catch (error) {
      this.logger.error(`Failed to queue bulk welcome emails`, error);
      throw error;
    }
  }
}