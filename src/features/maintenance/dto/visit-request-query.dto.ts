import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { VisitRequestSourceType, VisitRequestStatus } from '../schemas/visit-request.schema';

export class VisitRequestQueryDto {
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
    description: 'Filter by status',
    enum: VisitRequestStatus,
  })
  @IsOptional()
  @IsEnum(VisitRequestStatus)
  status?: VisitRequestStatus;

  @ApiPropertyOptional({
    description: 'Filter by source type',
    enum: VisitRequestSourceType,
  })
  @IsOptional()
  @IsEnum(VisitRequestSourceType)
  sourceType?: VisitRequestSourceType;

  @ApiPropertyOptional({
    description: 'Filter by ticket ID',
  })
  @IsOptional()
  @IsMongoId()
  ticketId?: string;

  @ApiPropertyOptional({
    description: 'Filter by scope of work ID',
  })
  @IsOptional()
  @IsMongoId()
  scopeOfWorkId?: string;

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
    description: 'Filter by contractor ID',
  })
  @IsOptional()
  @IsMongoId()
  contractorId?: string;

  @ApiPropertyOptional({
    description: 'Filter by tenant ID',
  })
  @IsOptional()
  @IsMongoId()
  tenantId?: string;

  @ApiPropertyOptional({
    description: 'Filter by visit date from',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  visitDateFrom?: Date;

  @ApiPropertyOptional({
    description: 'Filter by visit date to',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  visitDateTo?: Date;

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
