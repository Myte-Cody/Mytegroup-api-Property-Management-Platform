import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { EmailConfig, SendEmailOptions } from './interfaces/email.interface';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private async initializeTransporter() {
    const emailConfig: EmailConfig = this.configService.get<EmailConfig>('email');
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';
    
    // Use Ethereal for development debugging
    if (isDevelopment && emailConfig.useEthereal) {
      try {
        const testAccount = await nodemailer.createTestAccount();
        this.transporter = nodemailer.createTransport({
          host: 'smtp.ethereal.email',
          port: 587,
          secure: false,
          auth: {
            user: testAccount.user,
            pass: testAccount.pass,
          },
        });
        this.logger.log('Using Ethereal Email for development debugging');
        this.logger.log(`Ethereal credentials - User: ${testAccount.user}, Pass: ${testAccount.pass}`);
      } catch (error) {
        this.logger.error('Failed to create Ethereal test account, falling back to configured SMTP', error);
        this.createConfiguredTransporter(emailConfig);
      }
    } else {
      this.createConfiguredTransporter(emailConfig);
    }

    this.verifyConnection();
  }

  private createConfiguredTransporter(emailConfig: EmailConfig) {
    this.transporter = nodemailer.createTransport({
      host: emailConfig.host,
      port: emailConfig.port,
      secure: emailConfig.secure,
      auth: {
        user: emailConfig.auth.user,
        pass: emailConfig.auth.pass,
      },
    });
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('Email transporter connection verified successfully');
    } catch (error) {
      this.logger.error('Failed to verify email transporter connection', error);
    }
  }

  async sendMail(options: SendEmailOptions): Promise<void> {
    try {
      const emailConfig: EmailConfig = this.configService.get<EmailConfig>('email');
      const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';
      
      const mailOptions = {
        from: emailConfig.from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
        bcc: options.bcc ? (Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc) : undefined,
        attachments: options.attachments,
      };

      const result = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email sent successfully to ${options.to}. Message ID: ${result.messageId}`);
      
      // Log Ethereal preview URL in development
      if (isDevelopment && emailConfig.useEthereal) {
        const previewUrl = nodemailer.getTestMessageUrl(result);
        if (previewUrl) {
          this.logger.log(`📧 Ethereal preview URL: ${previewUrl}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to send email to ${options.to}`, error);
      throw error;
    }
  }

}
