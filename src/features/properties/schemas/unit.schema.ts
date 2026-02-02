import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';
import { Address } from './property.schema';

@Schema({ timestamps: true })
export class Unit extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
  })
  property: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 32 })
  unitNumber: string;

  @Prop({ required: true, min: 0 })
  size: number;

  @Prop({
    type: String,
    enum: UnitType,
    required: true,
  })
  type: UnitType;

  @Prop({
    type: String,
    enum: UnitAvailabilityStatus,
    default: UnitAvailabilityStatus.VACANT,
    required: true,
  })
  availabilityStatus: UnitAvailabilityStatus;

  @ApiProperty({
    description: 'Address information with coordinates and location details',
    required: false,
    example: {
      latitude: 40.7128,
      longitude: -74.006,
      city: 'New York',
      state: 'New York',
      country: 'United States',
    },
  })
  @Prop({
    type: Address,
    required: false,
    _id: false,
  })
  address?: Address;

  @Prop({ type: Boolean, default: false })
  availableForRent: boolean;

  @Prop({ type: Date })
  availableFrom?: Date;

  @Prop({ type: Boolean, default: false })
  publishToMarketplace: boolean;

  @Prop({ type: Number, min: 0 })
  marketRent?: number;

  deleted: boolean;
  deletedAt?: Date;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);

UnitSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Unit' },
});

UnitSchema.virtual('photos', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Unit', collection_name: 'unit_photos' },
});

UnitSchema.virtual('documents', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Unit', collection_name: 'documents' },
});

// Add indexes
UnitSchema.index(
  { landlord: 1, property: 1, unitNumber: 1 },
  { unique: true, name: 'unit_landlord_property_unique' },
);
UnitSchema.index({ landlord: 1, availabilityStatus: 1 });
UnitSchema.index({ landlord: 1, availabilityStatus: 1, createdAt: -1 });
UnitSchema.index({
  publishToMarketplace: 1,
  deleted: 1,
  'address.countryCode': 1,
  'address.city': 1,
  createdAt: -1,
});
UnitSchema.index({ unitNumber: 'text', 'property.name': 'text' });
UnitSchema.index({ property: 1, deleted: 1 });

// TypeScript types
export interface UnitQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, UnitDocument, UnitQueryHelpers> & UnitQueryHelpers;
}

export type UnitDocument = Unit & Document & SoftDelete;
export type UnitModel = Model<UnitDocument, UnitQueryHelpers>;

UnitSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UnitSchema.plugin(accessibleRecordsPlugin);
UnitSchema.plugin(multiTenancyPlugin);
