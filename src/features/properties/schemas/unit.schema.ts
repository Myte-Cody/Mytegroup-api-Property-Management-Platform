import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ApiProperty } from '@nestjs/swagger';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';
import { Address } from '../../../common/interfaces/address.interface';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Unit extends Document implements SoftDelete {
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
    type: {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
    },
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

UnitSchema.index(
  { unitNumber: 1, property: 1 },
  { unique: true, name: 'unit_number_property_unique' },
);

UnitSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UnitSchema.plugin(accessibleRecordsPlugin);
