import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum StripeEventStatus {
  PENDING = 'pending',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class StripeEvent extends Document {
  @Prop({ required: true, unique: true, index: true })
  eventId: string; // Stripe event ID (evt_xxx)

  @Prop({ required: true, index: true })
  eventType: string; // e.g., 'payment_intent.succeeded'

  @Prop({
    type: String,
    enum: StripeEventStatus,
    default: StripeEventStatus.PENDING,
    index: true,
  })
  status: StripeEventStatus;

  @Prop()
  processedAt?: Date;

  @Prop()
  error?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const StripeEventSchema = SchemaFactory.createForClass(StripeEvent);

// TTL index to automatically clean up old events after 90 days
StripeEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export type StripeEventDocument = StripeEvent & Document;
