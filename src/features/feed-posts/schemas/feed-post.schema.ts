import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

// PollOption subdocument
@Schema({ _id: true })
export class PollOption {
  _id: Types.ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ default: 0 })
  votes: number;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  voters: Types.ObjectId[];
}

export const PollOptionSchema = SchemaFactory.createForClass(PollOption);

// Poll subdocument
@Schema({ _id: false })
export class Poll {
  @Prop({ type: [PollOptionSchema], required: true })
  options: PollOption[];

  @Prop({ default: false })
  allowMultipleVotes: boolean;
}

export const PollSchema = SchemaFactory.createForClass(Poll);

// FeedPost main document
@Schema({ timestamps: true })
export class FeedPost extends Document implements SoftDelete {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
  })
  property: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
  })
  landlord: Types.ObjectId;

  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, maxlength: 5000 })
  description: string;

  @Prop({ type: PollSchema })
  poll?: Poll;

  @Prop({ default: 0 })
  upvotes: number;

  @Prop({ default: 0 })
  downvotes: number;

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  upvotedBy: Types.ObjectId[];

  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'User', default: [] })
  downvotedBy: Types.ObjectId[];

  createdAt: Date;
  updatedAt: Date;
  deleted: boolean;
  deletedAt?: Date;
}

export const FeedPostSchema = SchemaFactory.createForClass(FeedPost);

// Apply plugins
FeedPostSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all',
});
FeedPostSchema.plugin(accessibleRecordsPlugin);

// Virtual for media relationship
FeedPostSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'entityId',
  match: (feedPost: FeedPost) => ({
    entityType: 'FeedPost',
    entityId: feedPost._id,
  }),
});

// Ensure virtuals are included when converting to JSON
FeedPostSchema.set('toJSON', { virtuals: true });
FeedPostSchema.set('toObject', { virtuals: true });

export type FeedPostDocument = FeedPost & Document;
