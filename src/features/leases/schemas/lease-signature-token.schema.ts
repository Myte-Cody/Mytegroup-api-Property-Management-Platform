import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SignatureTokenStatus } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

@Schema({ timestamps: true })
export class LeaseSignatureToken extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lease',
    required: true,
    index: true,
  })
  lease: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenant: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({ required: true, unique: true, index: true })
  tokenHash: string;

  @Prop({
    type: String,
    enum: SignatureTokenStatus,
    default: SignatureTokenStatus.PENDING,
    index: true,
  })
  status: SignatureTokenStatus;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  usedAt?: Date;

  @Prop()
  invalidatedAt?: Date;

  @Prop({ maxlength: 500 })
  invalidationReason?: string;

  @Prop({ required: true })
  pdfVersionHash: string;

  // Soft delete
  deleted: boolean;
  deletedAt?: Date;
}

export const LeaseSignatureTokenSchema = SchemaFactory.createForClass(LeaseSignatureToken);

// TTL index for automatic cleanup of expired tokens (expire 7 days after expiresAt)
LeaseSignatureTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

// Compound index for efficient lookups
LeaseSignatureTokenSchema.index({ lease: 1, status: 1 });

LeaseSignatureTokenSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
LeaseSignatureTokenSchema.plugin(accessibleRecordsPlugin);
LeaseSignatureTokenSchema.plugin(multiTenancyPlugin);

export type LeaseSignatureTokenDocument = LeaseSignatureToken & Document & SoftDelete;
export type LeaseSignatureTokenModel = Model<LeaseSignatureTokenDocument>;
