import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { RentIncreaseType, RentalPeriodStatus } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

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
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

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

  deleted: boolean;
  deletedAt?: Date;
}

export const RentalPeriodSchema = SchemaFactory.createForClass(RentalPeriod);

const AppliedRentIncreaseSchema = SchemaFactory.createForClass(AppliedRentIncrease);

RentalPeriodSchema.add({
  appliedRentIncrease: {
    type: AppliedRentIncreaseSchema,
    required: false,
  },
});

// Add indexes
RentalPeriodSchema.index(
  { landlord: 1, lease: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: RentalPeriodStatus.ACTIVE },
    name: 'landlord_lease_active_rentalperiod_unique',
  },
);
RentalPeriodSchema.index({ landlord: 1, status: 1 });

// TypeScript types
export interface RentalPeriodQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, RentalPeriodDocument, RentalPeriodQueryHelpers> & RentalPeriodQueryHelpers;
}

export type RentalPeriodDocument = RentalPeriod & Document & SoftDelete;
export type RentalPeriodModel = Model<RentalPeriodDocument, RentalPeriodQueryHelpers>;

RentalPeriodSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
RentalPeriodSchema.plugin(accessibleRecordsPlugin);
RentalPeriodSchema.plugin(multiTenancyPlugin);
