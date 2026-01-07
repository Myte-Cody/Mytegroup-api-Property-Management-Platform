import { accessibleRecordsPlugin } from '@casl/mongoose';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';
import { Document, Model, Query, Types } from 'mongoose';
import * as mongooseDelete from 'mongoose-delete';
import { SoftDelete } from '../../../common/interfaces/soft-delete.interface';
import { multiTenancyPlugin } from '../../../common/plugins/multi-tenancy.plugin';

export enum ScheduleType {
  GARBAGE = 'garbage',
  RECYCLING = 'recycling',
}

export enum RecurrenceFrequency {
  NONE = 'none',
  WEEKLY = 'weekly',
  BIWEEKLY = 'biweekly',
  MONTHLY = 'monthly',
}

@Schema({ _id: false })
export class Recurrence {
  @Prop({
    type: String,
    enum: Object.values(RecurrenceFrequency),
    default: RecurrenceFrequency.NONE,
  })
  frequency: RecurrenceFrequency;

  @Prop({ type: Number, min: 0, max: 6 })
  dayOfWeek?: number; // 0 = Sunday, 6 = Saturday

  @Prop({ type: Number, min: 1, max: 31 })
  dayOfMonth?: number; // For monthly recurrence

  @Prop({ type: Date })
  endDate?: Date; // When recurrence should stop
}

@Schema({ timestamps: true })
export class Schedule extends Document implements SoftDelete {
  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Landlord',
    required: true,
    index: true,
  })
  landlord: mongoose.Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property',
    required: true,
    index: true,
  })
  property: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Unit',
    required: false,
  })
  unit?: Types.ObjectId;

  @Prop({
    type: String,
    enum: Object.values(ScheduleType),
    required: true,
  })
  type: ScheduleType;

  @Prop({ type: Date, required: true })
  scheduledDate: Date;

  @Prop({ type: String, trim: true })
  scheduledTime?: string; // e.g., "08:00", "14:30"

  @Prop({ type: Recurrence, _id: false })
  recurrence?: Recurrence;

  @Prop({ type: String, trim: true, maxlength: 500 })
  description?: string;

  @Prop({ type: Number, default: 1, min: 1, max: 7 })
  reminderDaysBefore: number; // How many days before to send reminder

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  createdBy: Types.ObjectId;

  @Prop({ type: Date })
  lastReminderSentAt?: Date;

  @Prop({ type: Date })
  nextOccurrence?: Date; // For recurring schedules, the next upcoming date

  deleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const ScheduleSchema = SchemaFactory.createForClass(Schedule);

// Add indexes for efficient querying
ScheduleSchema.index({ landlord: 1, property: 1, scheduledDate: 1 });
ScheduleSchema.index({ landlord: 1, type: 1 });
ScheduleSchema.index({ landlord: 1, deleted: 1, createdAt: -1 });
ScheduleSchema.index({ nextOccurrence: 1 }); // For reminder queries
ScheduleSchema.index({ scheduledDate: 1 }); // For upcoming schedules

// TypeScript types
export interface ScheduleQueryHelpers {
  byLandlord(
    landlordId: mongoose.Types.ObjectId | string,
  ): Query<any, ScheduleDocument, ScheduleQueryHelpers> & ScheduleQueryHelpers;
}

export type ScheduleDocument = Schedule & Document & SoftDelete;
export type ScheduleModel = Model<ScheduleDocument, ScheduleQueryHelpers>;

// Apply plugins
ScheduleSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' });
ScheduleSchema.plugin(accessibleRecordsPlugin);
ScheduleSchema.plugin(multiTenancyPlugin);

// Ensure virtuals are included in JSON
ScheduleSchema.set('toJSON', { virtuals: true });
ScheduleSchema.set('toObject', { virtuals: true });
