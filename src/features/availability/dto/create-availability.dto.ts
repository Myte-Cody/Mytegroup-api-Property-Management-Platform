import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AvailabilityType, DayOfWeek } from '../../../common/enums/availability.enum';

export class CreateAvailabilityDto {
  @ApiProperty({
    description: 'Property ID this availability is for',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  propertyId: string;

  @ApiPropertyOptional({
    description: 'Unit ID this availability is for (optional - if not provided, applies to property level)',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @ApiProperty({
    enum: AvailabilityType,
    description: 'Type of availability slot',
    example: AvailabilityType.ONE_TIME,
  })
  @IsEnum(AvailabilityType)
  availabilityType: AvailabilityType;

  @ApiPropertyOptional({
    description: 'Specific date for ONE_TIME availability (required when availabilityType is ONE_TIME)',
    example: '2024-03-15',
  })
  @ValidateIf((o) => o.availabilityType === AvailabilityType.ONE_TIME)
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    description: 'Day of week for RECURRING availability (required when availabilityType is RECURRING)',
    example: DayOfWeek.MONDAY,
  })
  @ValidateIf((o) => o.availabilityType === AvailabilityType.RECURRING)
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiProperty({
    description: 'Start time in HH:mm format (24-hour)',
    example: '09:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must be in HH:mm format (24-hour)',
  })
  startTime: string;

  @ApiProperty({
    description: 'End time in HH:mm format (24-hour)',
    example: '17:00',
  })
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must be in HH:mm format (24-hour)',
  })
  endTime: string;

  @ApiPropertyOptional({
    description: 'Optional notes for the availability slot',
    example: 'Preferred time for maintenance visits',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Effective start date for recurring availability',
    example: '2024-03-01',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  effectiveFrom?: Date;

  @ApiPropertyOptional({
    description: 'Effective end date for recurring availability (null for indefinite)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  effectiveUntil?: Date;

  @ApiPropertyOptional({
    description: 'Whether the slot is active',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean = true;
}
