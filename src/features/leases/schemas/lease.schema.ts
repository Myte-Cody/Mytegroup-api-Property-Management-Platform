import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { LeaseStatus, PaymentCycle, RentIncreaseType } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

@Schema()
export class RentIncrease {
  @Prop({
    type: String,
    enum: RentIncreaseType,
    required: true,
  })
  type: RentIncreaseType;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ maxlength: 500 })
  reason?: string;
}

const RentIncreaseSchema = SchemaFactory.createForClass(RentIncrease);

@Schema({ timestamps: true })
export class Lease extends Document implements SoftDelete {
  // Core Relationships
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true,
  })
  unit: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenant: Types.ObjectId;

  @Prop({ required: true, index: true })
  startDate: Date;

  // endDate is now calculated from the latest rental period
  // @Prop({ required: true, index: true })
  // endDate: Date;

  @Prop({ required: true, min: 0 })
  rentAmount: number;

  @Prop({ default: false })
  isSecurityDeposit: boolean;

  @Prop({ min: 0 })
  securityDepositAmount?: number;

  @Prop()
  securityDepositRefundedAt?: Date;

  @Prop({ maxlength: 500 })
  securityDepositRefundReason?: string;

  @Prop({
    type: String,
    enum: PaymentCycle,
    default: PaymentCycle.MONTHLY,
  })
  paymentCycle: PaymentCycle;


  @Prop({
    type: String,
    enum: LeaseStatus,
    default: LeaseStatus.DRAFT,
    index: true,
  })
  status: LeaseStatus;

  @Prop({ index: true })
  terminationDate?: Date;

  @Prop({ maxlength: 500 })
  terminationReason?: string;

  @Prop({ type: String, maxlength: 2000 })
  terms?: string;

  @Prop({ type: RentIncreaseSchema })
  rentIncrease?: RentIncrease;

  @Prop({ default: false })
  autoRenewal: boolean;

  @Prop()
  renewalNoticeDate?: Date;

  // Soft delete
  deleted: boolean;
  deletedAt?: Date;
}

export const LeaseSchema = SchemaFactory.createForClass(Lease);

// todo why we don't have virtual in other fields
LeaseSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Lease' },
});

LeaseSchema.virtual('documents', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Lease', collection_name: 'documents' },
});

LeaseSchema.virtual('contracts', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Lease', collection_name: 'contracts' },
});

LeaseSchema.virtual('rentalPeriods', {
  ref: 'RentalPeriod',
  localField: '_id',
  foreignField: 'lease',
});

LeaseSchema.virtual('endDate').get(function() {
  if ((this as any).rentalPeriods && (this as any).rentalPeriods.length > 0) {
    const latestPeriod = (this as any).rentalPeriods.reduce((latest: any, current: any) => {
      return new Date(current.endDate) > new Date(latest.endDate) ? current : latest;
    });
    return latestPeriod.endDate;
  }
  // Fallback for cases where rental periods aren't populated
  return undefined;
});

// todo check this index
LeaseSchema.index(
  { unit: 1, status: 1, tenant_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: LeaseStatus.ACTIVE },
    name: 'unit_active_lease_tenant_unique',
  },
);


LeaseSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
LeaseSchema.plugin(accessibleRecordsPlugin);
LeaseSchema.plugin(mongoTenant);
