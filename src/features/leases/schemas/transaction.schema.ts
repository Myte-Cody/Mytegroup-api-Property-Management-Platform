import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

@Schema({ timestamps: true })
export class Transaction extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Lease',
    required: false,
    index: true,
  })
  lease?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'RentalPeriod',
    index: true,
  })
  rentalPeriod?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    index: true,
  })
  property?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Unit',
    index: true,
  })
  unit?: Types.ObjectId;

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

  // Stripe payment fields
  @Prop({ index: true, sparse: true })
  stripePaymentIntentId?: string; // pi_xxx

  @Prop({ index: true, sparse: true })
  stripeChargeId?: string; // ch_xxx

  @Prop({ type: String, enum: ['card', 'manual'] })
  stripePaymentMethodType?: 'card' | 'manual';

  @Prop()
  stripeReceiptUrl?: string;

  @Prop({ type: Object })
  stripeMetadata?: {
    lastError?: string;
    failedAt?: Date;
    attemptCount?: number;
    disputeId?: string;
    disputeStatus?: string;
    disputeReason?: string;
    disputeClosedAt?: Date;
    refundedAmount?: number;
    refundedAt?: Date;
  };

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

// Add indexes
TransactionSchema.index({ landlord: 1, status: 1, dueDate: 1 });
TransactionSchema.index({ lease: 1, status: 1, paidAt: -1 });
TransactionSchema.index({ dueDate: 1, status: 1 });

// TypeScript types
export interface TransactionQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, TransactionDocument, TransactionQueryHelpers> & TransactionQueryHelpers;
}

export type TransactionDocument = Transaction & Document & SoftDelete;
export type TransactionModel = Model<TransactionDocument, TransactionQueryHelpers>;

TransactionSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TransactionSchema.plugin(accessibleRecordsPlugin);
TransactionSchema.plugin(multiTenancyPlugin);
