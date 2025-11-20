import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Query } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

@Schema()
export class Address {
  @Prop({ required: true, trim: true })
  street: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: false, trim: true })
  postalCode: string;

  @Prop({ required: true, trim: true })
  country: string;

  @Prop({ required: false, type: Number })
  latitude?: number;

  @Prop({ required: false, type: Number })
  longitude?: number;
}

@Schema({ timestamps: true })
export class Property extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 128 })
  name: string;

  @Prop({ type: Address, required: true })
  address: Address;

  @Prop({ maxlength: 1024, default: '' })
  description: string;

  deleted: boolean;
  deletedAt?: Date;
}

export const PropertySchema = SchemaFactory.createForClass(Property);

// Virtual for media relationship
PropertySchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Property' },
});

// Virtual for property photos
PropertySchema.virtual('photos', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Property', collection_name: 'property_photos' },
});

// Virtual for property documents
PropertySchema.virtual('documents', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Property', collection_name: 'documents' },
});

// Add indexes
PropertySchema.index({ landlord: 1, name: 1 });
PropertySchema.index({ landlord: 1, deleted: 1, createdAt: -1 });

// TypeScript types
export interface PropertyQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, PropertyDocument, PropertyQueryHelpers> & PropertyQueryHelpers;
}

export type PropertyDocument = Property & Document & SoftDelete;
export type PropertyModel = Model<PropertyDocument, PropertyQueryHelpers>;

PropertySchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
PropertySchema.plugin(accessibleRecordsPlugin);
PropertySchema.plugin(multiTenancyPlugin);
