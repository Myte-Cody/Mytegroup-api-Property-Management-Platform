import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

@Schema({ timestamps: true })
export class PasswordReset extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tokenHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;

  @Prop()
  usedAt?: Date;
}

export const PasswordResetSchema = SchemaFactory.createForClass(PasswordReset);

PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
PasswordResetSchema.plugin(accessibleRecordsPlugin);

