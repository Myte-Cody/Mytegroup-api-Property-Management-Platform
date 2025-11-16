import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { HasMimeType, IsFile, MaxFileSize, MemoryStoredFile } from 'nestjs-form-data';
import { PaymentMethod } from '../../../common/enums/lease.enum';

export class UploadTransactionProofDto {
  @ApiProperty({
    description: 'Method used for payment',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Date when payment was made',
    example: '2024-09-15T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  paidAt: Date;

  @ApiPropertyOptional({
    description: 'Optional notes about the transaction',
    example: 'Bank transfer completed via mobile app',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsFile({ each: true })
  @MaxFileSize(10 * 1024 * 1024, { each: true })
  @HasMimeType(['image/jpeg', 'image/jpg', 'image/png', 'image/gif'], {
    each: true,
  })
  media_files?: MemoryStoredFile[];
}

export class MarkTransactionPaidDto {
  @ApiProperty({
    description: 'Method used for payment',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsEnum(PaymentMethod)
  @IsNotEmpty()
  paymentMethod: PaymentMethod;

  @ApiProperty({
    description: 'Date when payment was made',
    example: '2024-09-15T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  paidAt: Date;

  @ApiPropertyOptional({
    description: 'Optional notes about the transaction',
    example: 'Transaction verified and confirmed in bank account',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
