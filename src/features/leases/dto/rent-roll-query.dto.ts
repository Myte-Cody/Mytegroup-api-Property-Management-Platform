import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export enum RentRollStatus {
  PAID = 'paid',
  PARTIAL = 'partial',
  OVERDUE = 'overdue',
  VACANT = 'vacant',
}

export enum RentRollSortBy {
  RENT_AMOUNT = 'rentAmount',
  DUE_DATE = 'dueDate',
  TENANT_NAME = 'tenantName',
  PROPERTY_NAME = 'propertyName',
  AMOUNT_COLLECTED = 'amountCollected',
  OUTSTANDING_BALANCE = 'outstandingBalance',
}

export class RentRollQueryDto {
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

  @ApiPropertyOptional({ description: 'Property ID to filter by' })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    enum: RentRollStatus,
    description: 'Payment status to filter by',
  })
  @IsOptional()
  @IsEnum(RentRollStatus)
  status?: RentRollStatus;

  @ApiPropertyOptional({
    enum: RentRollSortBy,
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsEnum(RentRollSortBy)
  sortBy?: RentRollSortBy;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description: 'Sort order',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({ description: 'Search term for tenant or property name' })
  @IsOptional()
  @IsString()
  search?: string;
}
