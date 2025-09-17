import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { LeaseStatus, PaymentCycle, RentIncreaseType } from '../../../common/enums/lease.enum';

export class RentIncreaseDto {
  @ApiProperty({
    description: 'Type of rent increase',
    enum: RentIncreaseType,
    example: RentIncreaseType.PERCENTAGE,
  })
  @IsEnum(RentIncreaseType)
  @IsNotEmpty()
  type: RentIncreaseType;

  @ApiProperty({
    description: 'Amount or percentage for rent increase',
    example: 5,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  amount: number;

  @ApiPropertyOptional({
    description: 'Reason for rent increase',
    example: 'Annual market adjustment',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CreateLeaseDto {
  @ApiProperty({
    description: 'Property ID where the unit is located',
    example: '673d8b8f123456789abcdef0',
  })
  @IsMongoId()
  @IsNotEmpty()
  property: string;

  @ApiProperty({
    description: 'Unit ID being leased',
    example: '673d8b8f123456789abcdef1',
  })
  @IsMongoId()
  @IsNotEmpty()
  unit: string;

  @ApiProperty({
    description: 'Tenant ID for the lease',
    example: '673d8b8f123456789abcdef2',
  })
  @IsMongoId()
  @IsNotEmpty()
  tenant: string;

  @ApiProperty({
    description: 'Lease start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({
    description: 'Lease end date',
    example: '2024-12-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  endDate: Date;

  @ApiProperty({
    description: 'Monthly rent amount',
    example: 1200,
    minimum: 0,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  rentAmount: number;

  @ApiPropertyOptional({
    description: 'Whether a security deposit is required for this lease',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isSecurityDeposit?: boolean;

  @ApiPropertyOptional({
    description: 'Security deposit amount (required if isSecurityDeposit is true)',
    example: 1200,
    minimum: 0,
  })
  @ValidateIf((o) => o.isSecurityDeposit === true)
  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  securityDepositAmount?: number;

  @ApiProperty({
    description: 'Payment cycle for rent',
    enum: PaymentCycle,
    example: PaymentCycle.MONTHLY,
  })
  @IsEnum(PaymentCycle)
  @IsNotEmpty()
  paymentCycle: PaymentCycle;

  @ApiPropertyOptional({
    description: 'Next payment due date (will be set after first payment is processed)',
    example: '2025-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextPaymentDueDate?: Date;

  @ApiPropertyOptional({
    description: 'Lease status',
    enum: LeaseStatus,
    example: LeaseStatus.DRAFT,
    default: LeaseStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(LeaseStatus)
  status?: LeaseStatus;

  @ApiPropertyOptional({
    description: 'Lease terms and conditions',
    example: 'Standard residential lease with pet policy...',
    maxLength: 5000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  terms?: string;

  @ApiPropertyOptional({
    description: 'Additional notes about the lease',
    example: 'Tenant requested early move-in date',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({
    description: 'Rent increase configuration for this lease',
    type: RentIncreaseDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentIncreaseDto)
  rentIncrease?: RentIncreaseDto;
}
