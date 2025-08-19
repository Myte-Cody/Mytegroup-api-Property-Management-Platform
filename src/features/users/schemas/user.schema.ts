import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
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
    required: false,
  })
  organization?: Types.ObjectId;

  @Prop({ default: false })
  isAdmin: boolean;

  deleted: boolean;
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UserSchema.plugin(accessibleRecordsPlugin);
