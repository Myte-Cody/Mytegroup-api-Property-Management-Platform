import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { RentalPeriodStatus } from '../../../common/enums/lease.enum';

export class RentalPeriodQueryDto {
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
    description: 'Field to sort by',
    example: 'startDate',
    default: 'startDate',
  })
  @IsOptional()
  @IsString()
  sortBy?: string = 'startDate';

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
    description: 'Filter by rental period status',
    enum: RentalPeriodStatus,
    example: RentalPeriodStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(RentalPeriodStatus)
  status?: RentalPeriodStatus;

  @ApiPropertyOptional({
    description: 'Filter by parent lease ID',
    example: '673d8b8f123456789abcdef0',
  })
  @IsOptional()
  @IsMongoId()
  leaseId?: string;

  @ApiPropertyOptional({
    description: 'Filter rental periods starting from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter rental periods starting up to this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  startDateTo?: Date;

  @ApiPropertyOptional({
    description: 'Filter rental periods ending from this date',
    example: '2024-01-01',
  })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter rental periods ending up to this date',
    example: '2024-12-31',
  })
  @IsOptional()
  @Transform(({ value }) => value ? new Date(value) : undefined)
  endDateTo?: Date;
}