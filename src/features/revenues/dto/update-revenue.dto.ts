import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';

export class UpdateRevenueDto {
  @ApiPropertyOptional({
    description: 'Lease ID this transaction belongs to (required for lease-based payment types)',
    example: '673d8b8f123456789abcdef0',
  })
  @IsOptional()
  @IsMongoId()
  lease?: string;

  @ApiPropertyOptional({
    description: 'Property ID for this transaction (required for non-lease payment types)',
    example: '673d8b8f123456789abcdef2',
  })
  @IsOptional()
  @IsMongoId()
  property?: string;

  @ApiPropertyOptional({
    description: 'Unit ID for this transaction (optional)',
    example: '673d8b8f123456789abcdef3',
  })
  @IsOptional()
  @IsMongoId()
  unit?: string;

  @ApiPropertyOptional({
    description: 'Transaction amount',
    example: 1200,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount?: number;

  @ApiPropertyOptional({
    description: 'Transaction due date',
    example: '2024-01-31T23:59:59.999Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dueDate?: Date;

  @ApiPropertyOptional({
    description: 'Date when transaction was made',
    example: '2024-01-30T10:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;

  @ApiPropertyOptional({
    description: 'Type of transaction',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  @IsOptional()
  @IsEnum(PaymentType)
  type?: PaymentType;

  @ApiPropertyOptional({
    description: 'Transaction status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @ApiPropertyOptional({
    description: 'Payment method used',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Additional notes about the transaction',
    example: 'Monthly rent payment',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
