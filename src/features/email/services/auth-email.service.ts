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

  async sendEmailVerification(to: string, verificationToken: string): Promise<void> {
    try {
      const clientBaseUrl = this.configService.get<string>('app.clientBaseUrl');
      const verificationUrl = `${clientBaseUrl}/verify-email?token=${verificationToken}`;

      const context = {
        verificationUrl,
        expirationTime: 24, // 24 hours for email verification
      };

      // You can create an email-verification template later if needed
      const subject = 'Verify Your Email Address';
      const html = `
        <h2>Email Verification Required</h2>
        <p>Please click the link below to verify your email address:</p>
        <p><a href="${verificationUrl}">Verify Email</a></p>
        <p>This link will expire in 24 hours.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `;
      const text = `Email verification required. Visit: ${verificationUrl}. This link expires in 24 hours.`;

      await this.emailService.sendMail({ to, subject, html, text });
      this.logger.log(`Email verification sent successfully to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email verification to ${to}`, error);
      throw error;
    }
  }
}
