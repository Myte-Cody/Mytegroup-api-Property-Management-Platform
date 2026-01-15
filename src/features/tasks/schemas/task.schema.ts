import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Schema as MongooseSchema, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { TaskPriority, TaskStatus } from '../../../common/enums/task.enum';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

// Status change log subdocument
@Schema({ _id: false })
export class TaskStatusLog {
  @Prop({
    type: String,
    enum: TaskStatus,
    required: true,
  })
  fromStatus: TaskStatus;

  @Prop({
    type: String,
    enum: TaskStatus,
    required: true,
  })
  toStatus: TaskStatus;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  changedBy: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  changedAt: Date;

  @Prop({ maxlength: 500, required: false })
  note?: string;
}

export const TaskStatusLogSchema = SchemaFactory.createForClass(TaskStatusLog);

@Schema({ timestamps: true })
export class Task extends Document implements SoftDelete {
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
  unit?: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ required: true, maxlength: 2000 })
  description: string;

  @Prop({
    type: String,
    enum: TaskStatus,
    default: TaskStatus.OPEN,
    required: true,
  })
  status: TaskStatus;

  @Prop({
    type: String,
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
    required: false,
  })
  priority?: TaskPriority;

  @Prop({
    type: Boolean,
    default: false,
  })
  isEscalated: boolean;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
  })
  assignedParty?: Types.ObjectId;

  @Prop({ maxlength: 1000, required: false })
  notes?: string;

  @Prop({
    type: [TaskStatusLogSchema],
    default: [],
  })
  statusLogs: TaskStatusLog[];

  deleted: boolean;
  deletedAt?: Date;
}

export const TaskSchema = SchemaFactory.createForClass(Task);

// Add indexes
TaskSchema.index({ landlord: 1, status: 1, priority: 1 });
TaskSchema.index({ landlord: 1, property: 1 });
TaskSchema.index({ landlord: 1, isEscalated: 1 });
TaskSchema.index({ property: 1, unit: 1 });
TaskSchema.index({ createdBy: 1 });

// TypeScript types
export interface TaskQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, TaskDocument, TaskQueryHelpers> & TaskQueryHelpers;
}

export type TaskDocument = Task & Document & SoftDelete;
export type TaskModel = Model<TaskDocument, TaskQueryHelpers>;

TaskSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
TaskSchema.plugin(accessibleRecordsPlugin);
TaskSchema.plugin(multiTenancyPlugin);
