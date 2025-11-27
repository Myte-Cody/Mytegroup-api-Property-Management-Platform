import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

export type NotificationDocument = Notification & Document & SoftDelete;

@Schema({ timestamps: true })
export class Notification extends Document implements SoftDelete {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 255 })
  title: string;

  @Prop({ required: true, trim: true })
  content: string;

  @Prop({ type: String, required: false, trim: true })
  actionUrl?: string;

  @Prop({ type: Date, default: null })
  readAt: Date | null;

  deleted: boolean;
  deletedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

// Add indexes for better query performance
NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });

NotificationSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
NotificationSchema.plugin(accessibleRecordsPlugin);
