import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsMongoId, IsOptional, IsString, Min } from 'class-validator';
import { ExpenseCategory, ExpenseStatus } from '../schemas/expense.schema';
import { ExpenseScope, ExpenseSource } from './expense-response.dto';

export class ExpenseQueryDto {
  @ApiProperty({ description: 'Page number', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: 'Items per page', required: false, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiProperty({ description: 'Property ID filter', required: false })
  @IsOptional()
  @IsMongoId()
  property?: string;

  @ApiProperty({ description: 'Unit ID filter', required: false })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiProperty({ description: 'Category filter', enum: ExpenseCategory, required: false })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @ApiProperty({ description: 'Status filter', enum: ExpenseStatus, required: false })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiProperty({ description: 'Scope of Work ID filter', required: false })
  @IsOptional()
  @IsMongoId()
  scopeOfWork?: string;

  @ApiProperty({ description: 'Maintenance Ticket ID filter', required: false })
  @IsOptional()
  @IsMongoId()
  ticket?: string;

  @ApiProperty({ description: 'Source filter', enum: ExpenseSource, required: false })
  @IsOptional()
  @IsEnum(ExpenseSource)
  source?: ExpenseSource;

  @ApiProperty({ description: 'Scope filter', enum: ExpenseScope, required: false })
  @IsOptional()
  @IsEnum(ExpenseScope)
  scope?: ExpenseScope;

  @ApiProperty({ description: 'Start date filter (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ description: 'End date filter (ISO format)', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiProperty({ description: 'Search query for description', required: false })
  @IsOptional()
  @IsString()
  search?: string;
}
