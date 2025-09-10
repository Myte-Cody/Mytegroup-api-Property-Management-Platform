import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

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
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true
  })
  landlord_id: Types.ObjectId; 

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

PropertySchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
PropertySchema.plugin(accessibleRecordsPlugin);
PropertySchema.plugin(mongoTenant);
