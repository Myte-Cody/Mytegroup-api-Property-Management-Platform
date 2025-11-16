import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';

@Schema({ timestamps: true })
export class VerificationToken extends Document {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  tokenHash: string; // for link verification

  @Prop()
  codeHash?: string; // for 6-digit code verification

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false })
  used: boolean;

  @Prop()
  usedAt?: Date;
}

export const VerificationTokenSchema = SchemaFactory.createForClass(VerificationToken);

VerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
VerificationTokenSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
VerificationTokenSchema.plugin(accessibleRecordsPlugin);
