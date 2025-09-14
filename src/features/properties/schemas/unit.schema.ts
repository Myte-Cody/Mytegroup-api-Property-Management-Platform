import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

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

  deleted: boolean;
  deletedAt?: Date;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);

// Add compound unique index for unit number per property within landlordd
UnitSchema.index(
  { unitNumber: 1, property: 1, tenantId: 1 },
  { unique: true, name: 'unit_number_property_tenant_unique' },
);

UnitSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
UnitSchema.plugin(accessibleRecordsPlugin);
UnitSchema.plugin(mongoTenant);
