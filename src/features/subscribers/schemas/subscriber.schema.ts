import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Subscriber extends Document {
  @Prop({ required: true, trim: true, lowercase: true, unique: true })
  email: string;

  @Prop({ trim: true })
  name?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop()
  lastChannel?: string;

  @Prop()
  lastSummary?: string;

  @Prop({ type: [String], default: [] })
  lastActionItems?: string[];

  @Prop()
  lastSentiment?: string;

  @Prop({ type: Date })
  lastFeedbackAt?: Date;
}

export type SubscriberDocument = Subscriber & Document;

export const SubscriberSchema = SchemaFactory.createForClass(Subscriber);
