import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

export type TicketCommentDocument = TicketComment & Document & SoftDelete;

@Schema({ timestamps: true })
export class TicketComment extends Document implements SoftDelete {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'MaintenanceTicket',
    required: true,
  })
  ticket: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  author: Types.ObjectId;

  @Prop({ required: true, maxlength: 2000 })
  content: string;

  deleted: boolean;
  deletedAt?: Date;
}

export const TicketCommentSchema = SchemaFactory.createForClass(TicketComment);

TicketCommentSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'TicketComment' },
});

TicketCommentSchema.virtual('attachments', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'TicketComment', collection_name: 'comment_attachments' },
});

TicketCommentSchema.index({ ticket: 1, createdAt: -1 });
TicketCommentSchema.index({ author: 1 });

TicketCommentSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TicketCommentSchema.plugin(accessibleRecordsPlugin);
