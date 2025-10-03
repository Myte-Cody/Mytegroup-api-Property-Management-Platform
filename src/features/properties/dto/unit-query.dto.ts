import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';

export class UnitQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search term to filter units (searches unit number)',
    example: 'A101',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'unitNumber',
    enum: ['unitNumber', 'size', 'type', 'availabilityStatus', 'createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['unitNumber', 'size', 'type', 'availabilityStatus', 'createdAt', 'updatedAt'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsString()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by unit type',
    example: UnitType.STUDIO,
    enum: UnitType,
  })
  @IsOptional()
  @IsEnum(UnitType)
  type?: UnitType;

  @ApiPropertyOptional({
    description: 'Filter by availability status',
    example: UnitAvailabilityStatus.VACANT,
    enum: UnitAvailabilityStatus,
  })
  @IsOptional()
  @IsEnum(UnitAvailabilityStatus)
  availabilityStatus?: UnitAvailabilityStatus;

  @ApiPropertyOptional({
    description: 'Property ID to filter units by property',
    type: String,
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Minimum unit size in square feet/meters',
    example: 500,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSize?: number;

  @ApiPropertyOptional({
    description: 'Maximum unit size in square feet/meters',
    example: 1500,
    type: Number,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSize?: number;

  // Internal field for landlord filtering - not exposed in API docs
  landlordId?: string;
}

export interface PaginatedUnitsResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
