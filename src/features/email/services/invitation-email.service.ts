import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
    this.frontendUrl = this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  }

  async sendInvitationEmail(
    to: string,
    invitationToken: string,
    entityType: string,
    expiresAt: Date,
    options?: {
      inviterName?: string;
      organizationName?: string;
      additionalInfo?: string;
      queue?: boolean;
    },
  ): Promise<void> {
    try {
      // Build invitation URL
      const invitationUrl = `${this.frontendUrl}/invitations/${invitationToken}`;

      // Prepare template context
      const context = {
        entityType,
        invitationUrl,
        expiresAt,
        inviterName: options?.inviterName,
        organizationName: options?.organizationName,
        additionalInfo: options?.additionalInfo,
      };

      // Compile the template
      const { html, subject, text } = await this.templateService.compileTemplate(
        'invitation',
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

  async sendBulkInvitationEmails(
    invitations: Array<{
      email: string;
      invitationToken: string;
      entityType: string;
      expiresAt: Date;
      inviterName?: string;
      organizationName?: string;
      additionalInfo?: string;
    }>,
  ): Promise<void> {
    try {
      // Compile all templates first
      const emailOptions = await Promise.all(
        invitations.map(async (invitation) => {
          const invitationUrl = `${this.frontendUrl}/invitations/accept/${invitation.invitationToken}`;

          const context = {
            entityType: invitation.entityType,
            invitationUrl,
            expiresAt: invitation.expiresAt,
            inviterName: invitation.inviterName,
            organizationName: invitation.organizationName,
            additionalInfo: invitation.additionalInfo,
          };

          const { html, subject, text } = await this.templateService.compileTemplate(
            'invitation',
            context,
          );

          return { to: invitation.email, subject, html, text };
        }),
      );

      await this.emailQueueService.queueBulkEmails(emailOptions);
      this.logger.log(`Bulk invitation emails queued for ${invitations.length} recipients`);
    } catch (error) {
      this.logger.error(`Failed to queue bulk invitation emails`, error);
      throw error;
    }
  }
}
