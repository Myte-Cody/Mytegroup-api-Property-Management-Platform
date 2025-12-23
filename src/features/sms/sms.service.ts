import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SendSmsOptions,
  SendSmsResult,
  SmsConfig,
} from './interfaces/sms.interface';
import { SmsMessage, SmsMessageDocument } from './schemas/sms-message.schema';

const Twilio = require('twilio');

@Injectable()
export class SmsService implements OnModuleInit {
  private readonly logger = new Logger(SmsService.name);
  private twilioClient: any;
  private clientInitialized = false;
  private smsConfig: SmsConfig;

  constructor(
    private configService: ConfigService,
    @InjectModel(SmsMessage.name)
    private smsMessageModel: Model<SmsMessageDocument>,
  ) {}

  async onModuleInit() {
    await this.initializeTwilioClient();
  }

  private async initializeTwilioClient() {
    try {
      this.smsConfig = this.configService.get<SmsConfig>('sms');

      if (!this.smsConfig?.enabled) {
        this.logger.warn('SMS is disabled via configuration (TWILIO_ENABLED=false)');
        this.clientInitialized = false;
        return;
      }

      if (!this.smsConfig.accountSid || !this.smsConfig.authToken) {
        this.logger.warn(
          'Twilio credentials not configured. SMS functionality will be disabled.',
        );
        this.clientInitialized = false;
        return;
      }

      this.twilioClient = Twilio(
        this.smsConfig.accountSid,
        this.smsConfig.authToken,
      );

      // Verify credentials by fetching account details
      await this.verifyCredentials();
      this.clientInitialized = true;
      this.logger.log('Twilio client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Twilio client', error);
      this.clientInitialized = false;
      throw error;
    }
  }

  private async verifyCredentials(): Promise<boolean> {
    try {
      if (this.twilioClient) {
        const account = await this.twilioClient.api.accounts(
          this.smsConfig.accountSid,
        ).fetch();
        this.logger.log(
          `Twilio account verified - SID: ${account.sid}, Status: ${account.status}`,
        );
        return true;
      } else {
        this.logger.error(
          'Cannot verify credentials: Twilio client is not initialized',
        );
        return false;
      }
    } catch (error) {
      this.logger.error('Failed to verify Twilio credentials', error);
      return false;
    }
  }

  async sendSms(options: SendSmsOptions): Promise<SendSmsResult> {
    try {
      // Check if SMS is enabled
      if (!this.smsConfig?.enabled) {
        this.logger.warn('SMS is disabled. Skipping SMS send.');
        return {
          success: false,
          error: 'SMS is disabled',
          to: Array.isArray(options.to) ? options.to[0] : options.to,
        };
      }

      // Make sure client is initialized
      if (!this.clientInitialized) {
        await this.initializeTwilioClient();
      }

      if (!this.twilioClient) {
        throw new Error('Twilio client is not initialized');
      }

      const toNumbers = Array.isArray(options.to) ? options.to : [options.to];
      const results: SendSmsResult[] = [];

      // Send SMS to each recipient
      for (const toNumber of toNumbers) {
        try {
          const messageOptions: any = {
            from: this.smsConfig.fromNumber,
            to: toNumber,
            body: options.body,
          };

          // Add media URLs if provided
          if (options.mediaUrl && options.mediaUrl.length > 0) {
            messageOptions.mediaUrl = options.mediaUrl;
          }

          // Add status callback if provided
          if (options.statusCallback) {
            messageOptions.statusCallback = options.statusCallback;
          }

          // Send message via Twilio
          const message = await this.twilioClient.messages.create(messageOptions);

          // Save message to database
          await this.saveMessage({
            to: toNumber,
            from: this.smsConfig.fromNumber,
            body: options.body,
            mediaUrl: options.mediaUrl,
            messageSid: message.sid,
            status: message.status,
            sentAt: new Date(),
          });

          this.logger.log(
            `SMS sent successfully to ${toNumber}. Message SID: ${message.sid}`,
          );

          results.push({
            success: true,
            messageSid: message.sid,
            status: message.status,
            to: toNumber,
          });
        } catch (error) {
          this.logger.error(`Failed to send SMS to ${toNumber}`, error);

          // Save failed message to database
          await this.saveMessage({
            to: toNumber,
            from: this.smsConfig.fromNumber,
            body: options.body,
            mediaUrl: options.mediaUrl,
            status: 'failed',
            errorMessage: error.message,
            errorCode: error.code,
          });

          results.push({
            success: false,
            error: error.message,
            to: toNumber,
          });
        }
      }

      // Return first result if single recipient, otherwise return all results
      return results.length === 1 ? results[0] : (results as any);
    } catch (error) {
      this.logger.error('Failed to send SMS', error);
      throw error;
    }
  }

  private async saveMessage(messageData: Partial<SmsMessage>): Promise<SmsMessageDocument> {
    try {
      const smsMessage = new this.smsMessageModel(messageData);
      return await smsMessage.save();
    } catch (error) {
      this.logger.error('Failed to save SMS message to database', error);
      // Don't throw error - we don't want to fail SMS send if database save fails
      return null;
    }
  }

  async updateMessageStatus(
    messageSid: string,
    status: string,
    errorCode?: string,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const updateData: any = { status };

      if (status === 'delivered') {
        updateData.deliveredAt = new Date();
      }

      if (errorCode) {
        updateData.errorCode = errorCode;
      }

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      await this.smsMessageModel.findOneAndUpdate(
        { messageSid },
        updateData,
        { new: true },
      );

      this.logger.log(`Updated message ${messageSid} status to ${status}`);
    } catch (error) {
      this.logger.error(
        `Failed to update message status for ${messageSid}`,
        error,
      );
    }
  }

  async getMessageStatus(messageSid: string): Promise<any> {
    try {
      if (!this.twilioClient) {
        throw new Error('Twilio client is not initialized');
      }

      const message = await this.twilioClient.messages(messageSid).fetch();

      // Update local database with latest status
      await this.updateMessageStatus(
        messageSid,
        message.status,
        message.errorCode?.toString(),
        message.errorMessage,
      );

      return {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        body: message.body,
        dateSent: message.dateSent,
        dateCreated: message.dateCreated,
        dateUpdated: message.dateUpdated,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
      };
    } catch (error) {
      this.logger.error(`Failed to get message status for ${messageSid}`, error);
      throw error;
    }
  }

  isEnabled(): boolean {
    return this.clientInitialized && this.smsConfig?.enabled === true;
  }
}
