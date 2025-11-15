import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Job } from 'bullmq';
import { Model } from 'mongoose';
import {
  FeedbackEntry,
  FeedbackEntryDocument,
  FeedbackPriority,
  FeedbackStatus,
} from '../schemas/feedback.schema';
import { FeedbackAnalysisService } from '../services/feedback-analysis.service';
import { FeedbackAnalysisJob } from '../services/feedback-queue.service';

@Processor('feedback-analysis')
@Injectable()
export class FeedbackProcessor extends WorkerHost {
  private readonly logger = new Logger(FeedbackProcessor.name);

  constructor(
    @InjectModel(FeedbackEntry.name)
    private readonly feedbackModel: Model<FeedbackEntryDocument>,
    private readonly feedbackAnalysisService: FeedbackAnalysisService,
  ) {
    super();
  }

  async process(job: Job<FeedbackAnalysisJob>): Promise<void> {
    const feedback = await this.feedbackModel.findById(job.data.feedbackId);
    if (!feedback) {
      this.logger.warn(`Feedback ${job.data.feedbackId} not found for analysis`);
      return;
    }

    feedback.status = FeedbackStatus.PROCESSING;
    await feedback.save();

    try {
      const analysis = await this.feedbackAnalysisService.analyze(feedback);
      feedback.analysis = analysis;
      feedback.priority = analysis.recommendedPriority ?? feedback.priority ?? FeedbackPriority.MEDIUM;
      feedback.status = FeedbackStatus.COMPLETED;
      feedback.analyzedAt = new Date();
      feedback.failureReason = undefined;
      await feedback.save();
      this.logger.log(`Feedback ${feedback._id.toString()} analyzed successfully`);
    } catch (error) {
      this.logger.error(`Feedback analysis failed for ${feedback._id.toString()}`, error.stack);
      feedback.status = FeedbackStatus.FAILED;
      feedback.failureReason = error.message;
      await feedback.save();
      throw error;
    }
  }
}
