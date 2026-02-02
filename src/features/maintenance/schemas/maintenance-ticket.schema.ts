import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../../common/enums/maintenance.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

@Schema({ timestamps: true })
export class MaintenanceTicket extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Property',
    required: true,
  })
  property: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Unit',
    required: false,
  })
  unit: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Contractor',
    required: false,
  })
  assignedContractor?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, maxlength: 2000 })
  description: string;

  @Prop({
    type: String,
    enum: TicketCategory,
    required: true,
  })
  category: TicketCategory;

  @Prop({
    type: String,
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
    required: false,
  })
  priority?: TicketPriority;

  @Prop({
    type: String,
    enum: TicketStatus,
    default: TicketStatus.OPEN,
    required: true,
  })
  status: TicketStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  requestedBy: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  assignedBy?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  assignedUser?: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  requestDate: Date;

  @Prop({ type: Date, required: false })
  assignedDate?: Date;

  @Prop({ type: Date, required: false })
  completedDate?: Date;

  @Prop({ maxlength: 1000, required: false })
  notes?: string;

  @Prop({ maxlength: 1000, required: false })
  refuseReason?: string;

  @Prop({ required: true, unique: true })
  ticketNumber: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ScopeOfWork',
    required: false,
  })
  scopeOfWork?: Types.ObjectId;

  @Prop({
    type: String,
    required: false,
    enum: ['web', 'mobile', 'voice', 'api'],
    default: 'web',
  })
  source?: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
  })
  metadata?: Record<string, any>;

  deleted: boolean;
  deletedAt?: Date;
}

export const MaintenanceTicketSchema = SchemaFactory.createForClass(MaintenanceTicket);

MaintenanceTicketSchema.virtual('media', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'MaintenanceTicket' },
});

MaintenanceTicketSchema.virtual('images', {
  ref: 'Media',
  localField: '_id',
  foreignField: 'model_id',
  match: { model_type: 'MaintenanceTicket', collection_name: 'ticket_images' },
});

// Add indexes
MaintenanceTicketSchema.index({ landlord: 1, status: 1, priority: 1 });
MaintenanceTicketSchema.index({ landlord: 1, status: 1, priority: 1, createdAt: -1 });
MaintenanceTicketSchema.index({ landlord: 1, assignedContractor: 1 });
MaintenanceTicketSchema.index({ assignedContractor: 1, status: 1 });
MaintenanceTicketSchema.index({ property: 1, unit: 1 });
MaintenanceTicketSchema.index({ property: 1, unit: 1, deleted: 1 });
MaintenanceTicketSchema.index({ requestedBy: 1, createdAt: -1 });
MaintenanceTicketSchema.index({ createdAt: -1, landlord: 1 });
MaintenanceTicketSchema.index({ title: 'text', description: 'text', ticketNumber: 'text' });

// TypeScript types
export interface MaintenanceTicketQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, MaintenanceTicketDocument, MaintenanceTicketQueryHelpers> &
    MaintenanceTicketQueryHelpers;
}

export type MaintenanceTicketDocument = MaintenanceTicket & Document & SoftDelete;
export type MaintenanceTicketModel = Model<
  MaintenanceTicketDocument,
  MaintenanceTicketQueryHelpers
>;

MaintenanceTicketSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
MaintenanceTicketSchema.plugin(accessibleRecordsPlugin);
MaintenanceTicketSchema.plugin(multiTenancyPlugin);
