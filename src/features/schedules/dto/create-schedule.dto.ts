import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RecurrenceFrequency, ScheduleType } from '../schemas/schedule.schema';

export class RecurrenceDto {
  @ApiProperty({
    description: 'Recurrence frequency',
    enum: RecurrenceFrequency,
    default: RecurrenceFrequency.NONE,
  })
  @IsEnum(RecurrenceFrequency)
  frequency: RecurrenceFrequency;

  @ApiProperty({
    description: 'Day of week (0=Sunday, 6=Saturday)',
    required: false,
    minimum: 0,
    maximum: 6,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({
    description: 'Day of month (1-31) for monthly recurrence',
    required: false,
    minimum: 1,
    maximum: 31,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dayOfMonth?: number;

  @ApiProperty({ description: 'End date for recurrence (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class CreateScheduleDto {
  @ApiProperty({ description: 'Property ID', type: String })
  @IsNotEmpty()
  @IsMongoId()
  property: string;

  @ApiProperty({ description: 'Unit ID (optional)', type: String, required: false })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiProperty({
    description: 'Schedule type',
    enum: ScheduleType,
  })
  @IsNotEmpty()
  @IsEnum(ScheduleType)
  type: ScheduleType;

  @ApiProperty({ description: 'Scheduled date (ISO format)' })
  @IsNotEmpty()
  @IsDateString()
  scheduledDate: string;

  @ApiProperty({
    description: 'Scheduled time (HH:mm format)',
    required: false,
    example: '08:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Time must be in HH:mm format',
  })
  scheduledTime?: string;

  @ApiProperty({
    description: 'Recurrence settings',
    type: RecurrenceDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RecurrenceDto)
  recurrence?: RecurrenceDto;

  @ApiProperty({
    description: 'Description (optional)',
    type: String,
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: 'Days before to send reminder (1-7)',
    default: 1,
    minimum: 1,
    maximum: 7,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  reminderDaysBefore?: number;
}
