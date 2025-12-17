import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

export interface InquiryVerificationEmailData {
  recipientName: string;
  recipientEmail: string;
  verificationCode: string;
  propertyName: string;
  unitIdentifier?: string;
  expiresInMinutes: number;
}

export interface InquiryReplyEmailData {
  recipientName: string;
  recipientEmail: string;
  propertyName: string;
  unitIdentifier?: string;
  originalMessage: string;
  replyMessage: string;
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
    private readonly configService: ConfigService,
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
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      // Prepare template context
      const context = {
        ...data,
        brandName,
        brandLogoUrl,
        brandColor,
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
   * Send verification code email for inquiry
   */
  async sendInquiryVerificationEmail(
    data: InquiryVerificationEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      const subject = `${brandName} - Verify your email to complete your inquiry`;

      // Simple HTML template for verification email
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${brandName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">Verify Your Email</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; line-height: 1.6;">
                Hi ${data.recipientName},
              </p>
              <p style="color: #52525b; margin: 0 0 24px 0; line-height: 1.6;">
                You're one step away from sending your inquiry about <strong>${data.propertyName}${data.unitIdentifier ? ` - Unit ${data.unitIdentifier}` : ''}</strong>.
              </p>
              <p style="color: #52525b; margin: 0 0 16px 0; line-height: 1.6;">
                Please use the following verification code to complete your inquiry:
              </p>
              <!-- Verification Code Box -->
              <div style="background-color: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: ${brandColor};">${data.verificationCode}</span>
              </div>
              <p style="color: #71717a; margin: 0 0 24px 0; font-size: 14px; text-align: center;">
                This code expires in ${data.expiresInMinutes} minutes.
              </p>
              <p style="color: #52525b; margin: 0; line-height: 1.6;">
                If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f4f5; padding: 24px 32px; text-align: center;">
              <p style="color: #71717a; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      const text = `
${brandName} - Verify Your Email

Hi ${data.recipientName},

You're one step away from sending your inquiry about ${data.propertyName}${data.unitIdentifier ? ` - Unit ${data.unitIdentifier}` : ''}.

Your verification code is: ${data.verificationCode}

This code expires in ${data.expiresInMinutes} minutes.

If you didn't request this, you can safely ignore this email.
      `.trim();

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue) {
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(
          `Inquiry verification email queued successfully for ${data.recipientEmail}`,
        );
      } else {
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Inquiry verification email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} inquiry verification email to ${data.recipientEmail}`,
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
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      // Prepare template context
      const context = {
        ...data,
        brandName,
        brandLogoUrl,
        brandColor,
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

  /**
   * Send inquiry reply email to the inquirer
   */
  async sendInquiryReplyEmail(
    data: InquiryReplyEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      const subject = `${brandName} - Response to your inquiry about ${data.propertyName}${data.unitIdentifier ? ` - Unit ${data.unitIdentifier}` : ''}`;

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 24px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">${brandName}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #18181b; margin: 0 0 16px 0; font-size: 20px;">You've Got a Response!</h2>
              <p style="color: #52525b; margin: 0 0 24px 0; line-height: 1.6;">
                Hi ${data.recipientName},
              </p>
              <p style="color: #52525b; margin: 0 0 24px 0; line-height: 1.6;">
                The property manager has responded to your inquiry about <strong>${data.propertyName}${data.unitIdentifier ? ` - Unit ${data.unitIdentifier}` : ''}</strong>.
              </p>

              <!-- Original Message -->
              <div style="background-color: #f4f4f5; border-left: 4px solid #d4d4d8; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: #71717a; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Your original message:</p>
                <p style="color: #52525b; margin: 0; line-height: 1.6;">${data.originalMessage}</p>
              </div>

              <!-- Reply -->
              <div style="background-color: #eff6ff; border-left: 4px solid ${brandColor}; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="color: ${brandColor}; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Response:</p>
                <p style="color: #1e3a5f; margin: 0; line-height: 1.6;">${data.replyMessage}</p>
              </div>

              <p style="color: #52525b; margin: 24px 0 0 0; line-height: 1.6;">
                If you have any further questions, feel free to reply to this email or visit our platform.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: #f4f4f5; padding: 24px 32px; text-align: center;">
              <p style="color: #71717a; margin: 0; font-size: 12px;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      const text = `
${brandName} - Response to Your Inquiry

Hi ${data.recipientName},

The property manager has responded to your inquiry about ${data.propertyName}${data.unitIdentifier ? ` - Unit ${data.unitIdentifier}` : ''}.

Your original message:
${data.originalMessage}

Response:
${data.replyMessage}

If you have any further questions, feel free to reply to this email or visit our platform.
      `.trim();

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue) {
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Inquiry reply email queued successfully for ${data.recipientEmail}`);
      } else {
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Inquiry reply email sent successfully to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} inquiry reply email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }
}
