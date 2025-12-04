import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum MessageSenderType {
  LANDLORD = 'LANDLORD',
  TENANT = 'TENANT',
  CONTRACTOR = 'CONTRACTOR',
  SYSTEM = 'SYSTEM', // For system-generated messages
}

export enum SystemMessageType {
  USER_JOINED = 'USER_JOINED',
  USER_LEFT = 'USER_LEFT',
  USER_REMOVED = 'USER_REMOVED',
  GROUP_RENAMED = 'GROUP_RENAMED',
  AVATAR_CHANGED = 'AVATAR_CHANGED',
  ADMIN_ADDED = 'ADMIN_ADDED',
  ADMIN_REMOVED = 'ADMIN_REMOVED',
  OWNERSHIP_TRANSFERRED = 'OWNERSHIP_TRANSFERRED',
}

export type ThreadMessageDocument = ThreadMessage & Document;

@Schema({
  timestamps: true,
  toJSON: {
    virtuals: true,
  },
})
export class ThreadMessage {
  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Thread' })
  thread: MongooseSchema.Types.ObjectId;

  @Prop({ required: true, maxlength: 5000 })
  content: string;

  @Prop({
    required: true,
    enum: MessageSenderType,
  })
  senderType: MessageSenderType;

  @Prop({ required: false, type: MongooseSchema.Types.ObjectId })
  senderId: MongooseSchema.Types.ObjectId;

  @Prop({ required: false })
  senderModel: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId }], default: [] })
  readBy: MongooseSchema.Types.ObjectId[];

  // System message fields
  @Prop({ type: Boolean, default: false })
  isSystemMessage: boolean;

  @Prop({ type: String, enum: Object.values(SystemMessageType), required: false })
  systemMessageType?: SystemMessageType;

  @Prop({ type: Object, required: false })
  metadata?: Record<string, any>; // Additional data for system messages (e.g., old/new names, user IDs)

  createdAt?: Date;
  updatedAt?: Date;
}

export const ThreadMessageSchema = SchemaFactory.createForClass(ThreadMessage);

// Indexes
ThreadMessageSchema.index({ thread: 1, createdAt: -1 });
ThreadMessageSchema.index({ senderId: 1, senderType: 1 });

// Virtual populate for media attachments
ThreadMessageSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'ThreadMessage' },
});
