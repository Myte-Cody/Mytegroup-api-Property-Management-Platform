import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  InvoiceIssuer,
  InvoiceLinkedEntityType,
  InvoiceStatus,
} from '../../../common/enums/maintenance.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

@Schema({ timestamps: true })
export class Invoice extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, default: 'USD', maxlength: 3 })
  currency: string;

  @Prop({ maxlength: 2000, required: false })
  description?: string;

  @Prop({
    type: String,
    enum: InvoiceIssuer,
    required: true,
  })
  issuer: InvoiceIssuer;

  @Prop({
    type: String,
    enum: InvoiceLinkedEntityType,
    required: true,
  })
  linkedEntityType: InvoiceLinkedEntityType;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    refPath: 'linkedEntityModel',
  })
  linkedEntityId: Types.ObjectId;

  @Prop({
    type: String,
    required: true,
  })
  linkedEntityModel: string; // 'MaintenanceTicket' or 'ScopeOfWork'

  @Prop({
    type: String,
    enum: InvoiceStatus,
    default: InvoiceStatus.DRAFT,
    required: true,
  })
  status: InvoiceStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({ type: String, maxlength: 5000, required: false })
  notes?: string;

  deleted: boolean;
  deletedAt?: Date;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

// Virtual populate for media attachments
InvoiceSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Invoice' },
});

// Add indexes
InvoiceSchema.index({ landlord: 1, status: 1 });
InvoiceSchema.index({ landlord: 1, issuer: 1 });
InvoiceSchema.index({ linkedEntityId: 1, linkedEntityType: 1 });

// TypeScript types
export interface InvoiceQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, InvoiceDocument, InvoiceQueryHelpers> & InvoiceQueryHelpers;
}

export type InvoiceDocument = Invoice & Document & SoftDelete;
export type InvoiceModel = Model<InvoiceDocument, InvoiceQueryHelpers>;

InvoiceSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
InvoiceSchema.plugin(accessibleRecordsPlugin);
InvoiceSchema.plugin(multiTenancyPlugin);
