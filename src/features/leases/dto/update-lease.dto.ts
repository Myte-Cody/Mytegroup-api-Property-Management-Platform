import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { CreateLeaseDto } from './create-lease.dto';

export class UpdateLeaseDto extends PartialType(CreateLeaseDto) {
  @ApiPropertyOptional({
    description: 'Date when lease was terminated',
    example: '2024-06-15T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Invalid termination date format' })
  terminationDate?: Date;

  @ApiPropertyOptional({
    description: 'Reason for lease termination',
    example: 'Tenant requested early termination',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Termination reason must be a string' })
  @MaxLength(500, { message: 'Termination reason cannot exceed 500 characters' })
  terminationReason?: string;

  @ApiPropertyOptional({
    description: 'Date when the security deposit was refunded',
    example: '2024-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'Invalid security deposit refund date format' })
  securityDepositRefundedAt?: Date;

  @ApiPropertyOptional({
    description: 'Reason or notes for security deposit refund',
    example: 'Full refund - no damages found',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Security deposit refund reason must be a string' })
  @MaxLength(500, { message: 'Security deposit refund reason cannot exceed 500 characters' })
  securityDepositRefundReason?: string;

  @ApiPropertyOptional({
    description: 'Whether the lease should automatically renew',
    example: true,
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value == 'string') return value == 'true';
    return value;
  })
  @IsBoolean({ message: 'Auto renewal must be a boolean value' })
  autoRenewal?: boolean;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'New document files to add to the lease',
    required: false,
  })
  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(
    [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    {
      each: true,
    },
  )
  documents?: MemoryStoredFile[];

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string' },
    description: 'IDs of existing documents to keep (all others will be removed)',
    required: false,
  })
  @Transform(({ value }) => {
    // Handle empty values
    if (!value) return [];

    // Handle string input (single ID)
    if (typeof value === 'string') return [value];

    // Handle array-like string input (comma-separated values)
    if (typeof value === 'string' && value.includes(',')) {
      return value
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id);
    }

    // Handle array input
    if (Array.isArray(value)) return value;

    // Default case: return as is if it's already an array, or empty array if invalid
    return Array.isArray(value) ? value : [];
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  existingDocumentIds?: string[];
}
