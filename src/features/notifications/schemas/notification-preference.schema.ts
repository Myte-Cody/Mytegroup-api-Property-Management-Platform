import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { NotificationType } from '@shared/notification-types';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationPreferenceDocument = NotificationPreference & Document;

@Schema({ timestamps: true })
export class NotificationPreference extends Document {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(NotificationType),
  })
  notificationType: NotificationType;

  @Prop({ type: Boolean, default: true })
  inApp: boolean;

  @Prop({ type: Boolean, default: true })
  email: boolean;

  @Prop({ type: Boolean, default: false })
  sms: boolean;
}

export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);

// Add compound index for fast lookups and enforce uniqueness
NotificationPreferenceSchema.index({ userId: 1, notificationType: 1 }, { unique: true });

NotificationPreferenceSchema.plugin(accessibleRecordsPlugin);
