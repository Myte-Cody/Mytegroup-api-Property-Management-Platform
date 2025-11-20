import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

export enum ExpenseCategory {
  MAINTENANCE_REPAIRS = 'Maintenance & Repairs',
  UTILITIES_ENERGY = 'Utilities & Energy',
  PROPERTY_MANAGEMENT_ADMIN = 'Property Management & Admin Fees',
  SUPPLIES_CONSUMABLES = 'Supplies & Consumables',
  LANDSCAPING_OUTDOOR = 'Landscaping & Outdoor Maintenance',
  CONTRACTOR_SERVICES = 'Contractor Services (External Work Orders)',
  INSURANCE_COMPLIANCE = 'Insurance & Compliance',
  STAFF_LABOR = 'Staff & Labor',
  TAXES_PERMITS = 'Taxes & Permits',
  CAPITAL_EXPENDITURES = 'Capital Expenditures',
  PROFESSIONAL_SERVICES = 'Professional Services',
}

export enum ExpenseStatus {
  DRAFT = 'Draft',
  CONFIRMED = 'Confirmed',
}

@Schema({ timestamps: true })
export class Expense {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Property', required: true })
  property: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Unit' })
  unit?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ScopeOfWork' })
  scopeOfWork?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'MaintenanceTicket' })
  ticket?: Types.ObjectId;

  @Prop({ type: String, enum: Object.values(ExpenseCategory), required: true })
  category: ExpenseCategory;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String })
  description?: string;

  @Prop({ type: Date, default: Date.now })
  date: Date;

  @Prop({ type: String, enum: Object.values(ExpenseStatus), default: ExpenseStatus.DRAFT })
  status: ExpenseStatus;

  // Virtual field for media
  media?: any[];

  createdAt: Date;
  updatedAt: Date;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

// Virtual populate for media attachments
ExpenseSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'Expense' },
});

// Add indexes
ExpenseSchema.index({ landlord: 1, category: 1, date: -1 });

// TypeScript types
export interface ExpenseQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, ExpenseDocument, ExpenseQueryHelpers> & ExpenseQueryHelpers;
}

export type ExpenseDocument = Expense & Document;
export type ExpenseModel = Model<ExpenseDocument, ExpenseQueryHelpers>;

ExpenseSchema.plugin(multiTenancyPlugin);

// Ensure virtuals are included in JSON
ExpenseSchema.set('toJSON', { virtuals: true });
ExpenseSchema.set('toObject', { virtuals: true });
