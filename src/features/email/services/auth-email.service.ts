import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    expirationTime: number = 1,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const clientBaseUrl = this.configService.get<string>('app.clientBaseUrl');
      const resetUrl = `${clientBaseUrl}/reset-password?token=${resetToken}`;

      // Always compile template first
      const context = { resetUrl, expirationTime };
      const { html, subject, text } = await this.templateService.compileTemplate(
        'password-reset',
        context,
      );
      const emailOptions = { to, subject, html, text };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Password reset email queued successfully for ${to}`);
      } else {
        // Send immediately (recommended for security emails)
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Password reset email sent successfully to ${to}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} password reset email to ${to}`,
        error,
      );
      throw error;
    }
  }

  async sendEmailVerification(
    to: string,
    verificationToken: string,
    code?: string,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const clientBaseUrl = this.configService.get<string>('app.clientBaseUrl');
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';
      const verifyUrl = `${clientBaseUrl}/verify-email?token=${verificationToken}`;

      const context = {
        verifyUrl,
        brandName,
        brandLogoUrl,
        brandColor,
        code: code || '',
        hours: 24,
      } as any;

      const { html, subject, text } = await this.templateService.compileTemplate('verify-email', context);
      const emailOptions = { to, subject, html, text };
      if (options?.queue) {
        await this.emailQueueService.queueEmail(emailOptions);
      } else {
        await this.emailService.sendMail(emailOptions);
      }
      this.logger.log(`Email verification sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email verification to ${to}`, error);
      throw error;
    }
  }
}
