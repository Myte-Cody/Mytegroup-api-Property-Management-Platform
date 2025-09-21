import { ApiPropertyOptional, PartialType, OmitType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsOptional,
  IsString,
  MaxLength,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments
} from 'class-validator';
import { CreateLeaseDto, StartDateBeforeEndDateValidator, AutoRenewalRequiresRentIncreaseValidator } from './create-lease.dto';
import { LeaseStatus } from '../../../common/enums/lease.enum';

export class UpdateLeaseDto extends PartialType(OmitType(CreateLeaseDto, ['rentalPeriodEndDate'] as const)) {
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
  @IsBoolean({ message: 'Auto renewal must be a boolean value' })
  autoRenewal?: boolean;
}
