import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsMongoId, IsOptional, IsPositive, IsString, Max, Min } from 'class-validator';
import { AvailabilityType, DayOfWeek } from '../../../common/enums/availability.enum';
import { AvailabilityCreatedBy } from '../schemas/availability.schema';

export class AvailabilityQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by property ID',
  })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by unit ID',
  })
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID (for landlords viewing tenant availability)',
  })
  @IsOptional()
  @IsMongoId()
  tenantId?: string;

  @ApiPropertyOptional({
    enum: AvailabilityCreatedBy,
    description: 'Filter by who created the availability',
  })
  @IsOptional()
  @IsEnum(AvailabilityCreatedBy)
  createdBy?: AvailabilityCreatedBy;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    enum: AvailabilityType,
    description: 'Filter by availability type',
  })
  @IsOptional()
  @IsEnum(AvailabilityType)
  availabilityType?: AvailabilityType;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    description: 'Filter by day of week (for recurring slots)',
  })
  @IsOptional()
  @IsEnum(DayOfWeek)
  dayOfWeek?: DayOfWeek;

  @ApiPropertyOptional({
    description: 'Filter by specific date (for one-time slots)',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @ApiPropertyOptional({
    description: 'Filter by date range start',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by date range end',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Sort field',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
