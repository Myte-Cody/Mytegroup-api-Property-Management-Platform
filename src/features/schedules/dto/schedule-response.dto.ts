import { ApiProperty } from '@nestjs/swagger';
import { RecurrenceFrequency, ScheduleType } from '../schemas/schedule.schema';

export class RecurrenceResponseDto {
  @ApiProperty({ enum: RecurrenceFrequency })
  frequency: RecurrenceFrequency;

  @ApiProperty({ required: false })
  dayOfWeek?: number;

  @ApiProperty({ required: false })
  dayOfMonth?: number;

  @ApiProperty({ required: false })
  endDate?: Date;
}

export class ScheduleResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  landlord: string;

  @ApiProperty()
  property: any; // Populated property object or ID

  @ApiProperty({ required: false })
  unit?: any; // Populated unit object or ID

  @ApiProperty({ enum: ScheduleType })
  type: ScheduleType;

  @ApiProperty()
  scheduledDate: Date;

  @ApiProperty({ required: false })
  scheduledTime?: string;

  @ApiProperty({ type: RecurrenceResponseDto, required: false })
  recurrence?: RecurrenceResponseDto;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  reminderDaysBefore: number;

  @ApiProperty()
  createdBy: any;

  @ApiProperty({ required: false })
  lastReminderSentAt?: Date;

  @ApiProperty({ required: false })
  nextOccurrence?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class ScheduleListResponseDto {
  @ApiProperty({ type: [ScheduleResponseDto] })
  data: ScheduleResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
