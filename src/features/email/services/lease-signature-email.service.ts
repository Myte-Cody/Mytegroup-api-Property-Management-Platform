import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../email.service';
import { EmailQueueService } from './email-queue.service';
import { TemplateService } from './template.service';

export interface SignatureRequestEmailData {
  tenantName: string;
  tenantEmail: string;
  landlordName: string;
  propertyName: string;
  unitIdentifier: string;
  propertyAddress: string;
  signatureUrl: string;
  expiresAt: Date;
  leaseStartDate: Date;
  leaseEndDate: Date;
  monthlyRent: number;
}

export interface SignatureConfirmationEmailData {
  recipientName: string;
  recipientEmail: string;
  isTenant: boolean;
  propertyName: string;
  unitIdentifier: string;
  signedAt: Date;
  signedBy?: string;
  downloadUrl: string;
}

@Injectable()
export class LeaseSignatureEmailService {
  private readonly logger = new Logger(LeaseSignatureEmailService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
    private readonly emailQueueService: EmailQueueService,
  ) {}

  async sendSignatureRequestEmail(
    data: SignatureRequestEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      const context = {
        ...data,
        brandName,
        brandLogoUrl,
        brandColor,
        currentYear: new Date().getFullYear(),
      };

      const { html, subject, text } = await this.templateService.compileTemplate(
        'lease-signature-request',
        context,
      );

      const emailOptions = {
        to: data.tenantEmail,
        subject,
        html,
        text,
      };

      if (options?.queue !== false) {
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Signature request email queued successfully for ${data.tenantEmail}`);
      } else {
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Signature request email sent successfully to ${data.tenantEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} signature request email to ${data.tenantEmail}`,
        error,
      );
      throw error;
    }
  }

  async sendSignatureConfirmationEmail(
    data: SignatureConfirmationEmailData,
    options?: { queue?: boolean },
  ): Promise<void> {
    try {
      const brandName = this.configService.get<string>('BRAND_NAME') || 'MYTE';
      const brandLogoUrl = this.configService.get<string>('BRAND_LOGO_URL') || '';
      const brandColor = this.configService.get<string>('BRAND_PRIMARY_COLOR') || '#2563eb';

      const context = {
        ...data,
        brandName,
        brandLogoUrl,
        brandColor,
        currentYear: new Date().getFullYear(),
      };

      const { html, subject, text } = await this.templateService.compileTemplate(
        'lease-signature-confirmation',
        context,
      );

      const emailOptions = {
        to: data.recipientEmail,
        subject,
        html,
        text,
      };

      if (options?.queue !== false) {
        await this.emailQueueService.queueEmail(emailOptions);
        this.logger.log(`Signature confirmation email queued for ${data.recipientEmail}`);
      } else {
        await this.emailService.sendMail(emailOptions);
        this.logger.log(`Signature confirmation email sent to ${data.recipientEmail}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to ${options?.queue ? 'queue' : 'send'} signature confirmation email to ${data.recipientEmail}`,
        error,
      );
      throw error;
    }
  }
}
