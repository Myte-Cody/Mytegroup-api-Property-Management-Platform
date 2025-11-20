import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { LeaseStatus, PaymentCycle, RentIncreaseType } from '../../../common/enums/lease.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

@Schema()
export class RentIncrease {
  @Prop({
    type: String,
    enum: RentIncreaseType,
    required: true,
  })
  type: RentIncreaseType;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ maxlength: 500 })
  reason?: string;
}

const RentIncreaseSchema = SchemaFactory.createForClass(RentIncrease);

@Schema()
export class DeductionItem {
  @Prop({ required: true, maxlength: 200 })
  description: string;

  @Prop({ required: true, min: 0 })
  cost: number;

  @Prop({ maxlength: 500 })
  notes?: string;
}

const DeductionItemSchema = SchemaFactory.createForClass(DeductionItem);

@Schema()
export class DepositAssessment {
  @Prop()
  assessmentDate: Date;

  @Prop({ type: [DeductionItemSchema], default: [] })
  deductionItems: DeductionItem[];

  @Prop({ required: true, min: 0 })
  totalDeductions: number;

  @Prop({ required: true, min: 0 })
  finalRefundAmount: number;

  @Prop({ maxlength: 1000 })
  assessmentNotes?: string;

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'disputed'],
    default: 'pending',
  })
  status: string;
}

const DepositAssessmentSchema = SchemaFactory.createForClass(DepositAssessment);

@Schema({ timestamps: true })
export class Lease extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Unit',
    required: true,
    index: true,
  })
  unit: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    index: true,
  })
  tenant: Types.ObjectId;

  @Prop({ required: true, index: true })
  startDate: Date;

  @Prop({ required: true, index: true })
  endDate: Date;

  @Prop({ required: true, min: 0 })
  rentAmount: number;

  @Prop({ default: false })
  isSecurityDeposit: boolean;

  @Prop({ min: 0 })
  securityDepositAmount?: number;

  @Prop()
  securityDepositRefundedAt?: Date;

  @Prop({ maxlength: 500 })
  securityDepositRefundReason?: string;

  @Prop({ type: DepositAssessmentSchema })
  depositAssessment?: DepositAssessment;

  @Prop({
    type: String,
    enum: PaymentCycle,
    default: PaymentCycle.MONTHLY,
  })
  paymentCycle: PaymentCycle;

  @Prop({
    type: String,
    enum: LeaseStatus,
    default: LeaseStatus.DRAFT,
    index: true,
  })
  status: LeaseStatus;

  @Prop({ index: true })
  terminationDate?: Date;

  @Prop({ maxlength: 500 })
  terminationReason?: string;

  @Prop({ type: String, maxlength: 2000 })
  terms?: string;

  @Prop({ type: RentIncreaseSchema })
  rentIncrease?: RentIncrease;

  @Prop({ default: false })
  autoRenewal: boolean;

  @Prop()
  activatedAt?: Date;

  // Soft delete
  deleted: boolean;
  deletedAt?: Date;
}

export const LeaseSchema = SchemaFactory.createForClass(Lease);

LeaseSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Lease' },
});

LeaseSchema.virtual('documents', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Lease', collection_name: 'documents' },
});

LeaseSchema.virtual('contracts', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Lease', collection_name: 'contracts' },
});

// Add indexes
LeaseSchema.index(
  { landlord: 1, unit: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: LeaseStatus.ACTIVE },
    name: 'landlord_unit_active_lease_unique',
  },
);
LeaseSchema.index({ landlord: 1, status: 1 });
LeaseSchema.index({ landlord: 1, tenant: 1 });

// Add query scope for multi-tenancy
// TypeScript types
export interface LeaseQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, LeaseDocument, LeaseQueryHelpers> & LeaseQueryHelpers;
}

export type LeaseDocument = Lease & Document & SoftDelete;
export type LeaseModel = Model<LeaseDocument, LeaseQueryHelpers>;

LeaseSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
LeaseSchema.plugin(accessibleRecordsPlugin);
LeaseSchema.plugin(multiTenancyPlugin);
