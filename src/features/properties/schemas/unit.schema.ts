import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

@Schema({ timestamps: true })
export class Unit extends Document implements SoftDelete {
  // Reference to the property this unit belongs to
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
  })
  property: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 32 })
  unitNumber: string;

  @Prop({ trim: true, maxlength: 16 })
  floor: string;

  @Prop({ min: 0 })
  sizeSqFt: number;

  @Prop({
    enum: ['Apartment', 'Studio', 'Office', 'Retail', 'Room', 'Other'],
    required: true,
  })
  type: string;

  @Prop({ min: 0 })
  bedrooms: number;

  @Prop({ min: 0 })
  bathrooms: number;

  @Prop({
    enum: ['Vacant', 'Occupied', 'Available for Rent'],
    default: 'Vacant',
    required: true,
  })
  availabilityStatus: string;

  @Prop({ min: 0 })
  rentAmount: number;

  @Prop({ maxlength: 1024 })
  description: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  tenants: Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Lease' }] })
  leases: Types.ObjectId[];

  deleted: boolean;
  deletedAt?: Date;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);

// Add mongoose-delete plugin with options
UnitSchema.plugin(mongooseDelete, {
  deletedAt: true,
  overrideMethods: 'all', // Override all methods including static methods
  indexFields: ['deleted'],
});
