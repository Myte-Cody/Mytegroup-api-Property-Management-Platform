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
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { LeaseStatus, PaymentCycle, RentIncreaseType } from '../../../common/enums/lease.enum';
import { getToday } from '../../../common/utils/date.utils';

// Custom validators
@ValidatorConstraint({ name: 'startDateBeforeEndDate', async: false })
export class StartDateBeforeEndDateValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as CreateLeaseDto;
    if (!dto.startDate || !dto.endDate) {
      return true;
    }
    return new Date(dto.startDate) < new Date(dto.endDate);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Start date must be before end date';
  }
}

@ValidatorConstraint({ name: 'autoRenewalRequiresRentIncrease', async: false })
export class AutoRenewalRequiresRentIncreaseValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as CreateLeaseDto;
    if (dto.autoRenewal) {
      return !!dto.rentIncrease;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Rent increase configuration is required when auto renewal is enabled';
  }
}

@ValidatorConstraint({ name: 'percentageLimit', async: false })
export class PercentageLimitValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    const dto = args.object as RentIncreaseDto;
    if (dto.type === RentIncreaseType.PERCENTAGE) {
      return dto.amount <= 100;
    }
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return 'Percentage increase cannot exceed 100%';
  }
}

@ValidatorConstraint({ name: 'endDateInFuture', async: false })
export class EndDateInFutureValidator implements ValidatorConstraintInterface {
  validate(value: any, args: ValidationArguments) {
    if (!value) return true;
    const endDate = new Date(value);
    const today = getToday();
    return endDate > today;
  }

  defaultMessage(args: ValidationArguments) {
    return 'End date must be in the future';
  }
}

export class RentIncreaseDto {
  @ApiProperty({
    description: 'Type of rent increase',
    enum: RentIncreaseType,
    example: RentIncreaseType.PERCENTAGE,
  })
  @IsEnum(RentIncreaseType, { message: 'Please select a valid rent increase type' })
  @IsNotEmpty({ message: 'Rent increase type is required' })
  type: RentIncreaseType;

  @ApiProperty({
    description: 'Amount or percentage for rent increase',
    example: 5,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Rent increase amount must be a number' })
  @Min(0.01, { message: 'Rent increase amount must be greater than 0' })
  @IsNotEmpty({ message: 'Rent increase amount is required' })
  @Validate(PercentageLimitValidator)
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
    description: 'Unit ID being leased',
    example: '673d8b8f123456789abcdef1',
  })
  @IsMongoId({ message: 'Invalid unit ID format' })
  @IsNotEmpty({ message: 'Unit is required' })
  unit: string;

  @ApiProperty({
    description: 'Tenant ID for the lease',
    example: '673d8b8f123456789abcdef2',
  })
  @IsMongoId({ message: 'Invalid tenant ID format' })
  @IsNotEmpty({ message: 'Tenant is required' })
  tenant: string;

  @ApiProperty({
    description: 'Lease start date',
    example: '2024-01-01T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate({ message: 'Invalid start date format' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate: Date;

  @ApiProperty({
    description: 'Lease end date',
    example: '2024-12-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate({ message: 'Invalid end date format' })
  @IsNotEmpty({ message: 'End date is required' })
  @Validate(StartDateBeforeEndDateValidator)
  @Validate(EndDateInFutureValidator)
  endDate: Date;

  @ApiProperty({
    description: 'Monthly rent amount',
    example: 1200,
    minimum: 0.01,
  })
  @Type(() => Number)
  @IsNumber({}, { message: 'Rent amount must be a number' })
  @Min(0.01, { message: 'Rent amount must be greater than 0' })
  @IsNotEmpty({ message: 'Rent amount is required' })
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
  @IsEnum(PaymentCycle, { message: 'Please select a valid payment cycle' })
  @IsNotEmpty({ message: 'Payment cycle is required' })
  paymentCycle: PaymentCycle;

  @ApiPropertyOptional({
    description: 'Next payment due date (will be set after first payment is processed)',
    example: '2025-09-01T00:00:00.000Z',
  })
  @ApiPropertyOptional({
    description: 'Lease status',
    enum: LeaseStatus,
    example: LeaseStatus.DRAFT,
    default: LeaseStatus.DRAFT,
  })
  @IsOptional()
  @IsEnum(LeaseStatus, { message: 'Please select a valid lease status' })
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
    description: 'Rent increase configuration for this lease',
    type: RentIncreaseDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentIncreaseDto)
  rentIncrease?: RentIncreaseDto;

  @ApiPropertyOptional({
    description: 'Whether the lease should automatically renew',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Validate(AutoRenewalRequiresRentIncreaseValidator)
  autoRenewal?: boolean;
}
