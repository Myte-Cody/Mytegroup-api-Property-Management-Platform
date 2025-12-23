import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

export type SmsMessageDocument = SmsMessage & Document & SoftDelete;

@Schema({ timestamps: true })
export class SmsMessage extends Document implements SoftDelete {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  })
  userId?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: false,
    index: true,
  })
  tenantId?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  to: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: String, required: false })
  from?: string;

  @Prop({ type: [String], required: false })
  mediaUrl?: string[];

  @Prop({ type: String, required: false, unique: true, sparse: true })
  messageSid?: string;

  @Prop({
    type: String,
    enum: ['queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed'],
    default: 'queued',
    index: true,
  })
  status: string;

  @Prop({ type: String, required: false })
  errorCode?: string;

  @Prop({ type: String, required: false })
  errorMessage?: string;

  @Prop({ type: Date, required: false })
  sentAt?: Date;

  @Prop({ type: Date, required: false })
  deliveredAt?: Date;

  @Prop({ type: String, required: false })
  messageType?: string;

  @Prop({ type: MongooseSchema.Types.Mixed, required: false })
  metadata?: Record<string, any>;

  deleted: boolean;
  deletedAt?: Date;
}

export const SmsMessageSchema = SchemaFactory.createForClass(SmsMessage);

// Add indexes for better query performance
SmsMessageSchema.index({ userId: 1, createdAt: -1 });
SmsMessageSchema.index({ tenantId: 1, createdAt: -1 });
SmsMessageSchema.index({ status: 1, createdAt: -1 });
SmsMessageSchema.index({ to: 1, createdAt: -1 });
SmsMessageSchema.index({ messageSid: 1 });

SmsMessageSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
SmsMessageSchema.plugin(accessibleRecordsPlugin);
