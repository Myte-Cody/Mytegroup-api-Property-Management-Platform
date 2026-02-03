import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, IsString, Max, Min, MaxLength, IsIn } from 'class-validator';
import { LeaseStatus } from '../../../common/enums/lease.enum';

export class LeaseQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
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
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Search term for lease terms, tenant name, or property address',
    example: 'apartment',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
    default: 'createdAt',
    enum: ['createdAt', 'updatedAt', 'startDate', 'endDate', 'rentAmount', 'status'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['createdAt', 'updatedAt', 'startDate', 'endDate', 'rentAmount', 'status'])
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Filter by lease status',
    enum: LeaseStatus,
    example: LeaseStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @ApiPropertyOptional({
    description: 'Filter by property ID',
    example: '673d8b8f123456789abcdef0',
  })
  @IsOptional()
  @IsMongoId()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Filter by unit ID',
    example: '673d8b8f123456789abcdef1',
  })
  @IsOptional()
  @IsMongoId()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
    example: '673d8b8f123456789abcdef2',
  })
  @IsOptional()
  @IsMongoId()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Filter leases starting from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  startDateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter leases starting up to this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  startDateTo?: Date;

  @ApiPropertyOptional({
    description: 'Filter leases ending from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  endDateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter leases ending up to this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  endDateTo?: Date;
}
