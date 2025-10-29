import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export enum MessageSenderType {
  LANDLORD = 'LANDLORD',
  TENANT = 'TENANT',
  CONTRACTOR = 'CONTRACTOR',
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

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId })
  senderId: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  senderModel: string;

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
