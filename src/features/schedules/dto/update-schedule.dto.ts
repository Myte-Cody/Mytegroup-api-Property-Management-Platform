import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ScheduleType } from '../schemas/schedule.schema';
import { RecurrenceDto } from './create-schedule.dto';

export class UpdateScheduleDto {
  @ApiProperty({ description: 'Property ID', type: String, required: false })
  @IsOptional()
  @IsMongoId()
  property?: string;

  @ApiProperty({ description: 'Unit ID (optional)', type: String, required: false })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiProperty({
    description: 'Schedule type',
    enum: ScheduleType,
    required: false,
  })
  @IsOptional()
  @IsEnum(ScheduleType)
  type?: ScheduleType;

  @ApiProperty({ description: 'Scheduled date (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

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
    minimum: 1,
    maximum: 7,
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  reminderDaysBefore?: number;

  @ApiProperty({
    description: 'Set to true to clear the unit association',
    required: false,
  })
  @IsOptional()
  clearUnit?: boolean;
}
