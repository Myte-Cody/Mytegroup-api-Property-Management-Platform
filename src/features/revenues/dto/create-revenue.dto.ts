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
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';

export class CreateRevenueDto {
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
    description: 'RentalPeriod ID this transaction belongs to (if applicable)',
    example: '673d8b8f123456789abcdef1',
  })
  @IsOptional()
  @IsMongoId()
  rentalPeriod?: string;

  @ApiProperty({
    description: 'Transaction amount',
    example: 1200,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiProperty({
    description: 'Transaction due date',
    example: '2024-01-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  dueDate: Date;

  @ApiPropertyOptional({
    description: 'Date when transaction was made',
    example: '2024-01-30T10:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  paidAt?: Date;

  @ApiProperty({
    description: 'Type of transaction',
    enum: PaymentType,
    example: PaymentType.RENT,
  })
  @IsEnum(PaymentType)
  @IsNotEmpty()
  type: PaymentType;

  @ApiPropertyOptional({
    description: 'Transaction status',
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
    description: 'Additional notes about the transaction',
    example: 'Monthly rent payment',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
