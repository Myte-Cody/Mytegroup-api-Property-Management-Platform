import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../../common/enums/maintenance.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

export type MaintenanceTicketDocument = MaintenanceTicket & Document & SoftDelete;

@Schema({ timestamps: true })
export class MaintenanceTicket extends Document implements SoftDelete {
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

  @Prop({ type: Date, default: Date.now })
  requestDate: Date;

  @Prop({ type: Date, required: false })
  assignedDate?: Date;

  @Prop({ type: Date, required: false })
  completedDate?: Date;

  @Prop({ maxlength: 1000, required: false })
  notes?: string;

  @Prop({ required: true, unique: true })
  ticketNumber: string;

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

MaintenanceTicketSchema.index({ property: 1, unit: 1 });
MaintenanceTicketSchema.index({ status: 1, priority: 1 });
MaintenanceTicketSchema.index({ assignedContractor: 1, status: 1 });

MaintenanceTicketSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
MaintenanceTicketSchema.plugin(accessibleRecordsPlugin);
