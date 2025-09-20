import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

@Schema({ timestamps: true })
export class Payment extends Document implements SoftDelete {
  // why relation with lease ?
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Lease',
    required: true,
    index: true,
  })
  lease: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RentalPeriod',
    index: true,
  })
  rentalPeriod?: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, index: true })
  dueDate: Date;

  @Prop({ index: true })
  paidAt?: Date;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
    index: true,
  })
  status: PaymentStatus;

  @Prop({
    type: String,
    enum: PaymentType,
    required: true,
    index: true,
  })
  type: PaymentType;

  @Prop({
    type: String,
    enum: PaymentMethod,
  })
  paymentMethod?: PaymentMethod;


  @Prop({ maxlength: 500 })
  notes?: string;


  // Soft delete
  deleted: boolean;
  deletedAt?: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);

// Virtual for media relationship
PaymentSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Payment' },
});

// Virtual for payment receipts
PaymentSchema.virtual('receipts', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Payment', collection_name: 'receipts' },
});

// Virtual for payment documents (invoices, statements, etc.)
PaymentSchema.virtual('documents', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Payment', collection_name: 'documents' },
});

PaymentSchema.virtual('paymentProofs', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Payment', collection_name: 'payment-proofs' },
});

PaymentSchema.index({ tenant_id: 1, lease: 1, dueDate: 1 });
PaymentSchema.index({ tenant_id: 1, status: 1, dueDate: 1 });
PaymentSchema.index({ lease: 1, type: 1, status: 1 });
PaymentSchema.index({ rentalPeriod: 1, status: 1 });
PaymentSchema.index({ dueDate: 1, status: 1 });
PaymentSchema.index({ paidAt: 1 });

PaymentSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
PaymentSchema.plugin(accessibleRecordsPlugin);
PaymentSchema.plugin(mongoTenant);
