import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { TicketStatus } from '../../../common/enums/maintenance.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';

export type ScopeOfWorkDocument = ScopeOfWork & Document & SoftDelete;

@Schema({ timestamps: true })
export class ScopeOfWork extends Document implements SoftDelete {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Contractor',
    required: false,
  })
  assignedContractor?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  assignedUser?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ScopeOfWork',
    required: false,
  })
  parentSow?: Types.ObjectId;

  @Prop({ required: true, unique: true })
  sowNumber: string;

  @Prop({ required: true, maxlength: 200 })
  title: string;

  @Prop({ required: false, maxlength: 2000 })
  description?: string;

  @Prop({
    type: String,
    enum: TicketStatus,
    default: TicketStatus.OPEN,
    required: true,
  })
  status: TicketStatus;

  @Prop({ type: Date, required: false })
  assignedDate?: Date;

  @Prop({ type: Date, required: false })
  completedDate?: Date;

  @Prop({ maxlength: 1000, required: false })
  notes?: string;

  @Prop({ maxlength: 1000, required: false })
  refuseReason?: string;

  deleted: boolean;
  deletedAt?: Date;
}

export const ScopeOfWorkSchema = SchemaFactory.createForClass(ScopeOfWork);

ScopeOfWorkSchema.index({ assignedContractor: 1, status: 1 });
ScopeOfWorkSchema.index({ parentSow: 1 });

ScopeOfWorkSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
ScopeOfWorkSchema.plugin(accessibleRecordsPlugin);
