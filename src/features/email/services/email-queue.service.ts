import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { EmailQueueOptions, SendEmailOptions } from '../interfaces/email.interface';
import { EmailService } from '../email.service';

export interface QueueEmailData {
  emailOptions: SendEmailOptions;
}

@Injectable()
export class EmailQueueService {
  private readonly logger = new Logger(EmailQueueService.name);

  constructor(
    @Optional() @InjectQueue('email') private emailQueue: Queue | undefined,
    private readonly emailService: EmailService,
  ) {}

  private get queuesEnabled(): boolean {
    return process.env.REDIS_DISABLE !== 'true' && !!this.emailQueue;
  }

  /**
   * Queue a compiled email for sending
   */
  async queueEmail(emailOptions: SendEmailOptions, options?: EmailQueueOptions): Promise<void> {
    try {
      if (!this.queuesEnabled) {
        this.logger.log(
          `Queues disabled; sending email synchronously for ${emailOptions.to} in local/dev mode.`,
        );
        await this.emailService.sendMail(emailOptions);
        return;
      }

      const job = await this.emailQueue.add(
        'send-email',
        { emailOptions },
        {
          delay: options?.delay,
          attempts: options?.attempts || 3,
          backoff: options?.backoff || { type: 'exponential', delay: 2000 },
        },
      );

      this.logger.log(`Added email job ${job.id} to queue for ${emailOptions.to}`);
    } catch (error) {
      this.logger.error(`Failed to add email to queue for ${emailOptions.to}`, error);
      throw error;
    }
  }

  /**
   * Queue multiple compiled emails efficiently
   */
  async queueBulkEmails(emails: SendEmailOptions[], options?: EmailQueueOptions): Promise<void> {
    try {
      if (!this.queuesEnabled) {
        this.logger.log(
          `Queues disabled; sending ${emails.length} emails synchronously in local/dev mode.`,
        );
        for (const email of emails) {
          await this.emailService.sendMail(email);
        }
        return;
      }

      const jobs = emails.map((emailOptions, index) => ({
        name: 'send-email',
        data: { emailOptions },
        opts: {
          delay: (options?.delay || 0) + index * 100, // Slight delay between emails
          attempts: options?.attempts || 3,
          backoff: options?.backoff || { type: 'exponential', delay: 2000 },
        },
      }));

      await this.emailQueue.addBulk(jobs);
      this.logger.log(`Added ${emails.length} bulk email jobs to queue`);
    } catch (error) {
      this.logger.error(`Failed to add bulk emails to queue`, error);
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
    const waiting = await this.emailQueue.getWaiting();
    const active = await this.emailQueue.getActive();
    const completed = await this.emailQueue.getCompleted();
    const failed = await this.emailQueue.getFailed();
    const delayed = await this.emailQueue.getDelayed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  async pauseQueue(): Promise<void> {
    await this.emailQueue.pause();
    this.logger.log('Email queue paused');
  }

  async resumeQueue(): Promise<void> {
    await this.emailQueue.resume();
    this.logger.log('Email queue resumed');
  }

  async clearQueue(): Promise<void> {
    await this.emailQueue.drain();
    this.logger.log('Email queue cleared');
  }

  async retryFailedJobs(): Promise<void> {
    const failedJobs = await this.emailQueue.getFailed();

    for (const job of failedJobs) {
      await job.retry();
    }

    this.logger.log(`Retried ${failedJobs.length} failed jobs`);
  }
}
