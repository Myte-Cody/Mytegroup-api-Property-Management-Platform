import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsMongoId, IsOptional, Min } from 'class-validator';
import { ExpenseCategory, ExpenseStatus } from '../schemas/expense.schema';

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
}
