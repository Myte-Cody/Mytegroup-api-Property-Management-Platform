import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from '../../users/schemas/user.schema';

export enum FeedbackPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum FeedbackStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum FeedbackMessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Schema({ _id: false })
export class FeedbackMessage {
  @Prop({ enum: FeedbackMessageRole, required: true })
  role: FeedbackMessageRole;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ type: Date, required: true })
  timestamp: Date;
}

const FeedbackMessageSchema = SchemaFactory.createForClass(FeedbackMessage);

@Schema({ _id: false })
export class FeedbackAnalysisSnapshot {
  @Prop()
  summary?: string;

  @Prop({ type: [String], default: [] })
  actionItems?: string[];

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop()
  sentiment?: string;

  @Prop({ enum: FeedbackPriority, default: FeedbackPriority.MEDIUM })
  recommendedPriority?: FeedbackPriority;

  @Prop()
  escalationRisk?: string;
}

const FeedbackAnalysisSchema = SchemaFactory.createForClass(FeedbackAnalysisSnapshot);

@Schema({ timestamps: true })
export class FeedbackEntry {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true, index: true })
  user: Types.ObjectId;

  @Prop({ required: true })
  userEmail: string;

  @Prop({ enum: FeedbackPriority, default: FeedbackPriority.MEDIUM })
  priority: FeedbackPriority;

  @Prop({ type: [FeedbackMessageSchema], required: true })
  conversation: FeedbackMessage[];

  @Prop({ default: FeedbackStatus.PENDING, enum: FeedbackStatus })
  status: FeedbackStatus;

  @Prop({ type: FeedbackAnalysisSchema })
  analysis?: FeedbackAnalysisSnapshot;

  @Prop({ type: Date })
  analyzedAt?: Date;

  @Prop()
  failureReason?: string;
}

export type FeedbackEntryDocument = FeedbackEntry & Document<Types.ObjectId>;

export const FeedbackEntrySchema = SchemaFactory.createForClass(FeedbackEntry);
