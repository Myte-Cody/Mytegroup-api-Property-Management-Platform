import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntityType } from '../../invitations/schemas/invitation.schema';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

@Injectable()
export class InvitationEmailService {
  private readonly logger = new Logger(InvitationEmailService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
    private readonly configService: ConfigService,
  ) {
    this.frontendUrl = this.configService.get<string>('CLIENT_BASE_URL') || 'http://localhost:3000';
  }

  async sendInvitationEmail(
    to: string,
    invitationToken: string,
    entityType: EntityType,
    expiresAt: Date,
    options?: {
      additionalInfo?: string;
      queue?: boolean;
      metadata?: Record<string, any>;
    },
  ): Promise<void> {
    try {
      // Build invitation URL
      const invitationUrl = `${this.frontendUrl}/invitation/${invitationToken}`;
      const templateName = entityType === EntityType.LANDLORD_STAFF ? 'invite-staff' : 'invitation';
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      // Prepare template context
      const context = {
        entityType,
        invitationUrl,
        expiresAt,
        additionalInfo: options?.additionalInfo,
        metadata: options?.metadata,
        brandName,
        brandLogoUrl,
        brandColor,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        templateName,
        context,
      );

      const emailOptions = { to, subject, html, text };

      if (options?.queue) {
        // Queue compiled email for background processing
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Invitation email queued successfully for ${to}`);
      } else {
        // Send immediately
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Invitation email sent successfully to ${to}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} invitation email to ${to}`,
        error,
      );
      throw error;
    }
  }
}
