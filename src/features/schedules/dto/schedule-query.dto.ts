import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { RecurrenceFrequency, ScheduleType } from '../schemas/schedule.schema';

export class ScheduleQueryDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ description: 'Property ID filter', required: false })
  @IsOptional()
  @IsMongoId()
  property?: string;

  @ApiProperty({ description: 'Unit ID filter', required: false })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiProperty({ description: 'Schedule type filter', enum: ScheduleType, required: false })
  @IsOptional()
  @IsEnum(ScheduleType)
  type?: ScheduleType;

  @ApiProperty({
    description: 'Recurrence frequency filter',
    enum: RecurrenceFrequency,
    required: false,
  })
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @ApiProperty({ description: 'Start date filter (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date filter (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Search query for description', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Show only upcoming schedules',
    required: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  upcomingOnly?: boolean;

  @ApiProperty({
    description: 'Sort field',
    required: false,
    default: 'scheduledDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'scheduledDate';

  @ApiProperty({
    description: 'Sort order (asc or desc)',
    required: false,
    default: 'asc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'asc';
}
