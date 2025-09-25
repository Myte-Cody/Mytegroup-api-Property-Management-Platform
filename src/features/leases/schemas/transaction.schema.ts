import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
const mongoTenant = require('mongo-tenant');

@Schema({ timestamps: true })
export class Transaction extends Document implements SoftDelete {
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

  @Prop({ required: true })
  amount: number;

  @Prop({ index: true })
  dueDate?: Date;

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

export const TransactionSchema = SchemaFactory.createForClass(Transaction);

// Virtual for media relationship
TransactionSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Transaction' },
});

// Virtual for transaction receipts
TransactionSchema.virtual('receipts', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Transaction', collection_name: 'receipts' },
});

// Virtual for transaction documents (invoices, statements, etc.)
TransactionSchema.virtual('documents', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Transaction', collection_name: 'documents' },
});

TransactionSchema.virtual('transactionProofs', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Transaction', collection_name: 'transaction-proofs' },
});

TransactionSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TransactionSchema.plugin(accessibleRecordsPlugin);
TransactionSchema.plugin(mongoTenant);
