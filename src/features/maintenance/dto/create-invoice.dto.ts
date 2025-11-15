import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';

export class CreateInvoiceDto {
  @ApiProperty({
    description: 'Invoice amount',
    example: 1500.0,
    minimum: 0,
  })
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Currency code (ISO 4217)',
    example: 'USD',
    default: 'USD',
    maxLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency: string;

  @ApiPropertyOptional({
    description: 'Description of the invoice',
    example: 'Labor and materials for plumbing repair',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the invoice',
    example: 'Payment due within 30 days',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  notes?: string;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Invoice file (PDF or image)',
    required: false,
  })
  @IsOptional()
  @IsFile()
  @MaxFileSize(10 * 1024 * 1024)
  @HasMimeType([
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
  ])
  invoice_file?: MemoryStoredFile;
}
