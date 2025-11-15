import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailService } from '../email.service';
import { QueueEmailData } from '../services/email-queue.service';
import { TemplateService } from '../services/template.service';

@Processor('email')
export class EmailQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailQueueProcessor.name);

  constructor(
    private readonly emailService: EmailService,
    private readonly templateService: TemplateService,
  ) {
    super();
  }

  async process(job: Job<QueueEmailData>): Promise<any> {
    switch (job.name) {
      case 'send-email':
        return await this.handleEmail(job);
      default:
        throw new Error(`Unknown job type: ${job.name}`);
    }
  }

  async handleEmail(job: Job<QueueEmailData>): Promise<void> {
    this.logger.log(`Processing email job ${job.id} to ${job.data.emailOptions.to}`);

    try {
      await this.emailService.sendMail(job.data.emailOptions);
      this.logger.log(`Email sent successfully to ${job.data.emailOptions.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email (job ${job.id}) to ${job.data.emailOptions.to}`,
        error,
      );
      throw error;
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<QueueEmailData>) {
    console.log(`Processing job ${job.id} of type ${job.name}...`);
  }
}
