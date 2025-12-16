import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { InquiryStatus, InquiryType } from '../../../common/enums/inquiry.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Inquiry extends Document implements SoftDelete {
  @Prop({
    type: String,
    enum: InquiryType,
    required: true,
  })
  inquiryType: InquiryType;

  @Prop({
    type: String,
    enum: InquiryStatus,
    default: InquiryStatus.SUBMITTED,
  })
  status: InquiryStatus;

  // Tenant reference (for authenticated users)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  tenant?: Types.ObjectId;

  // Contact info (nullable - will use tenant info if tenant is linked)
  @Prop({ trim: true })
  name?: string;

  @Prop({ trim: true, lowercase: true })
  email?: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: false,
  })
  property?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Unit',
    required: false,
  })
  unit?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  message: string;

  @Prop({ type: Date, required: false })
  preferredDate?: Date;

  // Email verification fields (for unauthenticated users)
  @Prop()
  verificationCode?: string;

  @Prop({ type: Date })
  verificationCodeExpiry?: Date;

  @Prop({ default: false })
  emailVerified: boolean;

  // Landlord reply
  @Prop({ trim: true })
  reply?: string;

  @Prop({ type: Date })
  repliedAt?: Date;

  deleted: boolean;
  deletedAt?: Date;
}

export const InquirySchema = SchemaFactory.createForClass(Inquiry);

InquirySchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
InquirySchema.plugin(accessibleRecordsPlugin);
