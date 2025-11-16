import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { ExpenseCategory, ExpenseStatus } from '../schemas/expense.schema';

export class CreateExpenseDto {
  @ApiProperty({ description: 'Property ID', type: String })
  @IsNotEmpty()
  @IsMongoId()
  property: string;

  @ApiProperty({ description: 'Unit ID (optional)', type: String, required: false })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiProperty({
    description: 'Expense category',
    enum: ExpenseCategory,
  })
  @IsNotEmpty()
  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @ApiProperty({ description: 'Expense amount', type: Number })
  @Transform(({ value }) => Number(value))
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @ApiProperty({ description: 'Expense description (optional)', type: String, required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: 'Expense status',
    enum: ExpenseStatus,
    default: ExpenseStatus.DRAFT,
    required: false,
  })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Media file (optional)',
    required: false,
  })
  @IsOptional()
  @IsFile()
  @MaxFileSize(10 * 1024 * 1024) // 10MB
  @HasMimeType(['image/*', 'application/pdf'])
  media?: MemoryStoredFile;
}
