import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

// todo check this type
export type UserDocument = User & Document & SoftDelete;

@Schema({ timestamps: true })
export class User extends Document implements SoftDelete {
  @Prop({ required: true, trim: true, maxlength: 64 })
  username: string;

  @Prop({ required: true, trim: true, maxlength: 50 })
  firstName: string;

  @Prop({ required: true, trim: true, maxlength: 50 })
  lastName: string;

  @Prop({
    required: true,
    trim: true,
    lowercase: true,
    match: /.+\@.+\..+/,
  })
  email: string;

  @Prop({ required: false, trim: true })
  phone?: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({
    type: String,
    required: true,
    enum: ['Landlord', 'Tenant', 'Contractor', 'Admin'],
  })
  user_type: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    refPath: 'user_type', // Dynamic reference based on user_type
  })
  organization_id: Types.ObjectId; // Points to Landlord/Tenant/Contractor

  @Prop({ type: Boolean, required: true, default: false })
  isPrimary: boolean;

  deleted: boolean;
  deletedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add unique indexes
UserSchema.index({ username: 1 }, { unique: true, name: 'username_unique' });
UserSchema.index({ email: 1 }, { unique: true, name: 'email_unique' });

UserSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UserSchema.plugin(accessibleRecordsPlugin);
