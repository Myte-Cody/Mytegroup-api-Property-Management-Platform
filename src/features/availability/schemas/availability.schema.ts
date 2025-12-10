import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { AvailabilityType, DayOfWeek } from '../../../common/enums/availability.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

// Who created this availability - tenant or landlord
export enum AvailabilityCreatedBy {
  TENANT = 'TENANT',
  LANDLORD = 'LANDLORD',
}

@Schema({ timestamps: true })
export class Availability extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  // Optional - only set for tenant-created availability
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  })
  tenant?: Types.ObjectId;

  // Required - the property this availability is for
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true,
  })
  property: Types.ObjectId;

  // Optional - the specific unit this availability is for (null means entire property)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    index: true,
  })
  unit?: Types.ObjectId;

  // Who created this availability
  @Prop({
    type: String,
    enum: AvailabilityCreatedBy,
    required: true,
  })
  createdBy: AvailabilityCreatedBy;

  @Prop({
    type: String,
    enum: AvailabilityType,
    required: true,
    default: AvailabilityType.ONE_TIME,
  })
  availabilityType: AvailabilityType;

  // For ONE_TIME slots: specific date
  @Prop({ type: Date })
  date?: Date;

  // For RECURRING slots: day of week
  @Prop({
    type: String,
    enum: DayOfWeek,
  })
  dayOfWeek?: DayOfWeek;

  // Start time in HH:mm format (24-hour)
  @Prop({ required: true })
  startTime: string;

  // End time in HH:mm format (24-hour)
  @Prop({ required: true })
  endTime: string;

  // Optional notes for the availability slot
  @Prop({ maxlength: 500 })
  notes?: string;

  // For recurring: effective start date
  @Prop({ type: Date })
  effectiveFrom?: Date;

  // For recurring: effective end date (optional, null means indefinite)
  @Prop({ type: Date })
  effectiveUntil?: Date;

  // Whether this slot is active
  @Prop({ default: true })
  isActive: boolean;

  // Soft delete fields
  deleted: boolean;
  deletedAt?: Date;
}

export const AvailabilitySchema = SchemaFactory.createForClass(Availability);

// Add indexes for common queries
AvailabilitySchema.index({ landlord: 1, property: 1 });
AvailabilitySchema.index({ landlord: 1, unit: 1 });
AvailabilitySchema.index({ tenant: 1, unit: 1 });
AvailabilitySchema.index({ property: 1, date: 1 });
AvailabilitySchema.index({ unit: 1, dayOfWeek: 1 });
AvailabilitySchema.index({ createdBy: 1, isActive: 1 });

// TypeScript types for query helpers
export interface AvailabilityQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, AvailabilityDocument, AvailabilityQueryHelpers> &
    AvailabilityQueryHelpers;
}

export type AvailabilityDocument = Availability & Document & SoftDelete;
export type AvailabilityModel = Model<
  AvailabilityDocument,
  AvailabilityQueryHelpers
>;

AvailabilitySchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
AvailabilitySchema.plugin(accessibleRecordsPlugin);
AvailabilitySchema.plugin(multiTenancyPlugin);
