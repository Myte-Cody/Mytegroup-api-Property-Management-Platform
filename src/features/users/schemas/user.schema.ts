import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class User extends Document implements SoftDelete {
  @Prop({ required: true, trim: true, maxlength: 64, unique: true })
  username: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    match: /.+\@.+\..+/,
  })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  })
  organization: Types.ObjectId;

  deleted: boolean;
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add mongoose-delete plugin with options
UserSchema.plugin(mongooseDelete, { deletedAt: true });
