import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { AvailabilityType, DayOfWeek } from '../../../common/enums/availability.enum';

export class UpdateAvailabilityDto {
  @ApiPropertyOptional({
    enum: AvailabilityType,
    description: 'Type of availability slot',
  })
  @IsOptional()
  @IsEnum(AvailabilityType)
  availabilityType?: AvailabilityType;

  @ApiPropertyOptional({
    description: 'Specific date for ONE_TIME availability',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    description: 'Day of week for RECURRING availability',
  })
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({
    description: 'Start time in HH:mm format (24-hour)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (24-hour)',
  })
  startTime?: string;

  @ApiPropertyOptional({
    description: 'End time in HH:mm format (24-hour)',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  endTime?: string;

  @ApiPropertyOptional({
    description: 'Optional notes for the availability slot',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Effective start date for recurring availability',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  effectiveFrom?: Date;

  @ApiPropertyOptional({
    description: 'Effective end date for recurring availability',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  effectiveUntil?: Date;

  @ApiPropertyOptional({
    description: 'Whether the slot is active',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;
}
