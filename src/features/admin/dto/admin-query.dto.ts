import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

/**
 * Base query DTO for admin endpoints with pagination, sorting, and optional landlord filtering.
 */
export class AdminQueryDto {
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
    description: 'Search term to filter results',
    example: 'example search',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
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
    description: 'Filter by specific landlord ID (optional)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  landlordId?: string;
}

/**
 * Extended query DTO for user-related admin endpoints.
 */
export class AdminUserQueryDto extends AdminQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user type',
    example: 'Landlord',
    enum: ['Landlord', 'Tenant', 'Contractor', 'Admin'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['Landlord', 'Tenant', 'Contractor', 'Admin'])
  userType?: string;
}

/**
 * Extended query DTO for maintenance-related admin endpoints.
 */
export class AdminMaintenanceQueryDto extends AdminQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    example: 'OPEN',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by priority',
    example: 'HIGH',
  })
  @IsOptional()
  @IsString()
  priority?: string;
}

/**
 * Extended query DTO for lease-related admin endpoints.
 */
export class AdminLeaseQueryDto extends AdminQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by lease status',
    example: 'ACTIVE',
    enum: ['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'])
  status?: string;
}

/**
 * Extended query DTO for transaction-related admin endpoints.
 */
export class AdminTransactionQueryDto extends AdminQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by transaction status',
    example: 'PAID',
    enum: ['PENDING', 'PAID', 'OVERDUE'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'PAID', 'OVERDUE'])
  status?: string;

  @ApiPropertyOptional({
    description: 'Filter by transaction type',
    example: 'RENT',
  })
  @IsOptional()
  @IsString()
  type?: string;
}

/**
 * Extended query DTO for audit log admin endpoints.
 */
export class AdminAuditLogQueryDto extends AdminQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by user ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Filter by action name (e.g., AdminUsersController.getUsers)',
    example: 'AdminUsersController.getUsers',
  })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Filter from date (ISO 8601 format)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter to date (ISO 8601 format)',
    example: '2024-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  endDate?: string;
}

/**
 * Standard paginated response interface for admin endpoints.
 */
export interface AdminPaginatedResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
