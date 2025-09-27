import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

@Schema()
export class Address {
  @Prop({ required: true, trim: true })
  street: string;

  @Prop({ required: true, trim: true })
  city: string;

  @Prop({ required: true, trim: true })
  state: string;

  @Prop({ required: true, trim: true })
  postalCode: string;

  @Prop({ required: true, trim: true })
  country: string;
}

@Schema({ timestamps: true })
export class Property extends Document implements SoftDelete {
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

// Add unique index
PropertySchema.index({ name: 1 }, { unique: true, name: 'property_name_unique' });

PropertySchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
PropertySchema.plugin(accessibleRecordsPlugin);
