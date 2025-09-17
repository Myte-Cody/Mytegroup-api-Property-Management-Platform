import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '../../../common/enums/lease.enum';

export class CreatePaymentDto {
  @ApiProperty({
    description: 'Lease ID this payment belongs to',
    example: '673d8b8f123456789abcdef0',
  })
  @IsMongoId()
  @IsNotEmpty()
  lease: string;

  @ApiPropertyOptional({
    description: 'RentalPeriod ID this payment belongs to (if applicable)',
    example: '673d8b8f123456789abcdef1',
  })
  @IsOptional()
  @IsMongoId()
  rentalPeriod?: string;

  @ApiProperty({
    description: 'Payment amount',
    example: 1200,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Payment due date',
    example: '2024-01-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  dueDate: Date;

  @ApiPropertyOptional({
    description: 'Date when payment was made',
    example: '2024-01-30T10:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paymentDate?: Date;

  @ApiProperty({
    description: 'Type of payment',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  @IsEnum(PaymentType)
  @IsNotEmpty()
  type: PaymentType;

  @ApiPropertyOptional({
    description: 'Payment status',
    enum: PaymentStatus,
    example: PaymentStatus.PENDING,
    default: PaymentStatus.PENDING,
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
    description: 'Transaction reference or ID',
    example: 'TXN123456789',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionReference?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the payment',
    example: 'Late payment due to bank processing delay',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}