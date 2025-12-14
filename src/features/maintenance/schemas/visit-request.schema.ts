import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

export enum VisitRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  DECLINED = 'DECLINED',
  AWAITING_RESCHEDULE = 'AWAITING_RESCHEDULE',
  RESCHEDULED = 'RESCHEDULED',
  BOOKED = 'BOOKED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum VisitRequestSourceType {
  TICKET = 'TICKET',
  SCOPE_OF_WORK = 'SCOPE_OF_WORK',
  MARKETPLACE = 'MARKETPLACE',
}

export enum VisitRequestTargetType {
  UNIT = 'UNIT',
  PROPERTY = 'PROPERTY',
}

@Schema({ timestamps: true })
export class VisitRequest extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  // The contractor requesting the visit (only for TICKET/SCOPE_OF_WORK sources)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contractor',
    index: true,
  })
  contractor?: Types.ObjectId;

  // The user who created the request (contractor user, only for TICKET/SCOPE_OF_WORK sources)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  })
  requestedBy?: Types.ObjectId;

  // Contact information for marketplace visit requests
  @Prop()
  fullName?: string;

  @Prop()
  email?: string;

  @Prop()
  phoneNumber?: string;

  // Source of the visit request (ticket or SOW)
  @Prop({
    type: String,
    enum: VisitRequestSourceType,
    required: true,
  })
  sourceType: VisitRequestSourceType;

  // Reference to the ticket (if source is TICKET)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenanceTicket',
    index: true,
  })
  ticket?: Types.ObjectId;

  // Reference to the scope of work (if source is SCOPE_OF_WORK)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScopeOfWork',
    index: true,
  })
  scopeOfWork?: Types.ObjectId;

  // Target type (unit or property-wide)
  @Prop({
    type: String,
    enum: VisitRequestTargetType,
    required: true,
  })
  targetType: VisitRequestTargetType;

  // The property for the visit
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true,
  })
  property: Types.ObjectId;

  // The unit for the visit (if target is UNIT)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    index: true,
  })
  unit?: Types.ObjectId;

  // The tenant associated with the unit (for unit visits)
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    index: true,
  })
  tenant?: Types.ObjectId;

  // The availability slot the contractor is requesting
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Availability',
    required: true,
  })
  availabilitySlot: Types.ObjectId;

  // The specific date for the visit
  @Prop({ type: Date, required: true })
  visitDate: Date;

  // Start and end times from the availability slot
  @Prop({ required: true })
  startTime: string;

  @Prop({ required: true })
  endTime: string;

  // Optional message from contractor
  @Prop({ maxlength: 1000 })
  message?: string;

  // Status of the request
  @Prop({
    type: String,
    enum: VisitRequestStatus,
    default: VisitRequestStatus.PENDING,
    required: true,
  })
  status: VisitRequestStatus;

  // Response message from tenant/landlord when accepting/refusing
  @Prop({ maxlength: 1000 })
  responseMessage?: string;

  // Who responded to the request
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  })
  respondedBy?: Types.ObjectId;

  // When the response was made
  @Prop({ type: Date })
  respondedAt?: Date;

  // Soft delete fields
  deleted: boolean;
  deletedAt?: Date;
}

export const VisitRequestSchema = SchemaFactory.createForClass(VisitRequest);

// Add indexes for common queries
VisitRequestSchema.index({ landlord: 1, status: 1 });
VisitRequestSchema.index({ contractor: 1, status: 1 });
VisitRequestSchema.index({ tenant: 1, status: 1 });
VisitRequestSchema.index({ ticket: 1 });
VisitRequestSchema.index({ scopeOfWork: 1 });
VisitRequestSchema.index({ visitDate: 1, status: 1 });

// TypeScript types for query helpers
export interface VisitRequestQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, VisitRequestDocument, VisitRequestQueryHelpers> & VisitRequestQueryHelpers;
}

export type VisitRequestDocument = VisitRequest & Document & SoftDelete;
export type VisitRequestModel = Model<VisitRequestDocument, VisitRequestQueryHelpers>;

VisitRequestSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
VisitRequestSchema.plugin(accessibleRecordsPlugin);
VisitRequestSchema.plugin(multiTenancyPlugin);