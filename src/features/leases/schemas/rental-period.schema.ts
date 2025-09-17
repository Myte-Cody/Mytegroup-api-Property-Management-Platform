import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { RentIncreaseType, RentalPeriodStatus } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

@Schema()
export class AppliedRentIncrease {
  @Prop({
    type: String,
    enum: RentIncreaseType,
    required: true,
  })
  type: RentIncreaseType;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, min: 0 })
  previousRent: number;

  @Prop({ maxlength: 500 })
  reason?: string;
}

@Schema({ timestamps: true })
export class RentalPeriod extends Document implements SoftDelete {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Lease',
    required: true,
    index: true,
  })
  lease: Types.ObjectId;

  @Prop({ required: true, index: true })
  startDate: Date;

  @Prop({ required: true, index: true })
  endDate: Date;

  @Prop({ required: true, min: 0 })
  rentAmount: number;

  @Prop({
    type: String,
    enum: RentalPeriodStatus,
    default: RentalPeriodStatus.ACTIVE,
    index: true,
  })
  status: RentalPeriodStatus;

  // appliedRentIncrease is defined manually in schema creation
  appliedRentIncrease?: AppliedRentIncrease;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RentalPeriod',
    index: true,
  })
  renewedFrom?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RentalPeriod',
    index: true,
  })
  renewedTo?: Types.ObjectId;

  @Prop({ maxlength: 500 })
  renewalNotes?: string;

  deleted: boolean;
  deletedAt?: Date;
}

export const RentalPeriodSchema = SchemaFactory.createForClass(RentalPeriod);

// Create separate schema for AppliedRentIncrease embedded document
const AppliedRentIncreaseSchema = SchemaFactory.createForClass(AppliedRentIncrease);

// Use the schema for the appliedRentIncrease field
RentalPeriodSchema.add({
  appliedRentIncrease: {
    type: AppliedRentIncreaseSchema,
    required: false,
  },
});

RentalPeriodSchema.index(
  { lease: 1, status: 1, tenant_id: 1 },
  {
    unique: true,
    partialFilterExpression: { status: RentalPeriodStatus.ACTIVE },
    name: 'lease_active_rentalperiod_tenant_unique',
  },
);

RentalPeriodSchema.index({ tenant_id: 1, lease: 1, startDate: 1 });
RentalPeriodSchema.index({ lease: 1, status: 1, endDate: 1 });
RentalPeriodSchema.index({ renewedFrom: 1 }); 
RentalPeriodSchema.index({ renewedTo: 1 });

RentalPeriodSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
RentalPeriodSchema.plugin(accessibleRecordsPlugin);
RentalPeriodSchema.plugin(mongoTenant);
