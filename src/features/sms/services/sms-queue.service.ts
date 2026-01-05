import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { SendSmsOptions, SmsQueueOptions } from '../interfaces/sms.interface';
import { SmsService } from '../sms.service';

export interface QueueSmsData {
  smsOptions: SendSmsOptions;
}

@Injectable()
export class SmsQueueService {
  private readonly logger = new Logger(SmsQueueService.name);

  constructor(
    @Optional() @InjectQueue('sms') private smsQueue: Queue | undefined,
    private readonly smsService: SmsService,
  ) {}

  private get queuesEnabled(): boolean {
    return process.env.REDIS_DISABLE !== 'true' && !!this.smsQueue;
  }

  /**
   * Queue a compiled SMS for sending
   */
  async queueSms(smsOptions: SendSmsOptions, options?: SmsQueueOptions): Promise<void> {
    try {
      if (!this.queuesEnabled) {
        this.logger.log(
          `Queues disabled; sending SMS synchronously to ${smsOptions.to} in local/dev mode.`,
        );
        await this.smsService.sendSms(smsOptions);
        return;
      }

      const job = await this.smsQueue.add(
        'send-sms',
        { smsOptions },
        {
          delay: options?.delay,
          attempts: options?.attempts || 3,
          backoff: options?.backoff || { type: 'exponential', delay: 2000 },
          priority: options?.priority,
        },
      );

      this.logger.log(`Added SMS job ${job.id} to queue for ${smsOptions.to}`);
    } catch (error) {
      this.logger.error(`Failed to add SMS to queue for ${smsOptions.to}`, error);
      throw error;
    }
  }

  /**
   * Queue multiple compiled SMS messages efficiently
   */
  async queueBulkSms(messages: SendSmsOptions[], options?: SmsQueueOptions): Promise<void> {
    try {
      if (!this.queuesEnabled) {
        this.logger.log(
          `Queues disabled; sending ${messages.length} SMS messages synchronously in local/dev mode.`,
        );
        for (const message of messages) {
          await this.smsService.sendSms(message);
        }
        return;
      }

      const jobs = messages.map((smsOptions, index) => ({
        name: 'send-sms',
        data: { smsOptions },
        opts: {
          delay: (options?.delay || 0) + index * 100, // Slight delay between messages
          attempts: options?.attempts || 3,
          backoff: options?.backoff || { type: 'exponential', delay: 2000 },
          priority: options?.priority,
        },
      }));

      await this.smsQueue.addBulk(jobs);
      this.logger.log(`Added ${messages.length} bulk SMS jobs to queue`);
    } catch (error) {
      this.logger.error(`Failed to add bulk SMS to queue`, error);
      throw error;
    }
  }

  async getQueueStatus(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    if (!this.queuesEnabled) {
      this.logger.warn('Queues are disabled. Cannot get queue status.');
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    const waiting = await this.smsQueue.getWaiting();
    const active = await this.smsQueue.getActive();
    const completed = await this.smsQueue.getCompleted();
    const failed = await this.smsQueue.getFailed();
    const delayed = await this.smsQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async pauseQueue(): Promise<void> {
    if (!this.queuesEnabled) {
      this.logger.warn('Queues are disabled. Cannot pause queue.');
      return;
    }

    await this.smsQueue.pause();
    this.logger.log('SMS queue paused');
  }

  async resumeQueue(): Promise<void> {
    if (!this.queuesEnabled) {
      this.logger.warn('Queues are disabled. Cannot resume queue.');
      return;
    }

    await this.smsQueue.resume();
    this.logger.log('SMS queue resumed');
  }

  async clearQueue(): Promise<void> {
    if (!this.queuesEnabled) {
      this.logger.warn('Queues are disabled. Cannot clear queue.');
      return;
    }

    await this.smsQueue.drain();
    this.logger.log('SMS queue cleared');
  }

  async retryFailedJobs(): Promise<void> {
    if (!this.queuesEnabled) {
      this.logger.warn('Queues are disabled. Cannot retry failed jobs.');
      return;
    }

    const failedJobs = await this.smsQueue.getFailed();

    for (const job of failedJobs) {
      await job.retry();
    }

    this.logger.log(`Retried ${failedJobs.length} failed jobs`);
  }
}
