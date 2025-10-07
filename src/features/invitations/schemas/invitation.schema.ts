import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from 'src/common/interfaces/soft-delete.interface';

export enum InvitationStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
}

export enum EntityType {
  TENANT = 'tenant',
  CONTRACTOR = 'contractor',
}

@Schema({ timestamps: true })
export class Invitation extends Document implements SoftDelete {
  @Prop({ required: true, type: Types.ObjectId })
  invitedBy: Types.ObjectId;

  @Prop({ required: true, enum: Object.values(EntityType) })
  entityType: EntityType;

  @Prop({ required: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: Object, default: {} })
  entityData: {
    [key: string]: any;
  };

  @Prop({ required: true, unique: true })
  invitationToken: string;

  @Prop({
    required: true,
    enum: Object.values(InvitationStatus),
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop()
  acceptedAt?: Date;

  deleted: boolean;
  deletedAt?: Date;
}

export const InvitationSchema = SchemaFactory.createForClass(Invitation);

InvitationSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
InvitationSchema.plugin(accessibleRecordsPlugin);
