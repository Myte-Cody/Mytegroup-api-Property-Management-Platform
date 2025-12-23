import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QueueSmsData } from '../services/sms-queue.service';
import { SmsService } from '../sms.service';

@Processor('sms')
export class SmsQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SmsQueueProcessor.name);

  constructor(private readonly smsService: SmsService) {
    super();
  }

  async process(job: Job<QueueSmsData>): Promise<any> {
    switch (job.name) {
      case 'send-sms':
        return await this.handleSms(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  async handleSms(job: Job<QueueSmsData>): Promise<void> {
    this.logger.log(
      `Processing SMS job ${job.id} to ${job.data.smsOptions.to}`,
    );

    try {
      await this.smsService.sendSms(job.data.smsOptions);
      this.logger.log(`SMS sent successfully to ${job.data.smsOptions.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send SMS (job ${job.id}) to ${job.data.smsOptions.to}`,
        error,
      );
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(_job: Job<QueueSmsData>) {
    // Job is being processed
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<QueueSmsData>) {
    this.logger.log(`SMS job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<QueueSmsData>, error: Error) {
    this.logger.error(`SMS job ${job.id} failed`, error);
  }
}
