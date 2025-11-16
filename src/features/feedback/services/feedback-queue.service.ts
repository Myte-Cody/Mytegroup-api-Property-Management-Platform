import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';

export interface FeedbackAnalysisJob {
  feedbackId: string;
}

@Injectable()
export class FeedbackQueueService {
  private readonly logger = new Logger(FeedbackQueueService.name);

  constructor(
    @Optional()
    @InjectQueue('feedback-analysis')
    private readonly queue: Queue<FeedbackAnalysisJob> | undefined,
  ) {}

  private get queuesEnabled(): boolean {
    return process.env.REDIS_DISABLE !== 'true' && !!this.queue;
  }

  async enqueueAnalysis(feedbackId: string): Promise<void> {
    if (!this.queuesEnabled) {
      this.logger.log(
        `Queues disabled; skipping enqueue of feedback analysis job for entry ${feedbackId} in local/dev mode.`,
      );
      return;
    }

    const job = await this.queue.add(
      'analyze-feedback',
      { feedbackId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnFail: 50,
        removeOnComplete: 100,
      },
    );
    this.logger.log(`Queued feedback analysis job ${job.id} for entry ${feedbackId}`);
  }
}
