import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { InquiryType } from '../../../common/enums/inquiry.enum';

export class InquiryQueryDto {
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
    description: 'Search term to filter inquiries (searches name, email, phone)',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Field to sort by',
    example: 'createdAt',
    enum: ['name', 'email', 'inquiryType', 'createdAt', 'updatedAt'],
    default: 'createdAt',
  })
  @IsOptional()
  @IsString()
  @IsIn(['name', 'email', 'inquiryType', 'createdAt', 'updatedAt'])
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
    description: 'Filter by inquiry type',
    example: InquiryType.VISIT,
    enum: InquiryType,
  })
  @IsOptional()
  @IsEnum(InquiryType)
  inquiryType?: InquiryType;

  @ApiPropertyOptional({
    description: 'Property ID to filter inquiries by property',
    type: String,
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Unit ID to filter inquiries by unit',
    type: String,
  })
  @IsOptional()
  @IsString()
  unitId?: string;
}

export interface PaginatedInquiriesResponse<T = any> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
