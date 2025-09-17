import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateLeaseDto } from './create-lease.dto';

export class UpdateLeaseDto extends PartialType(CreateLeaseDto) {
  @ApiPropertyOptional({
    description: 'Date when lease was terminated',
    example: '2024-06-15T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date;

  @ApiPropertyOptional({
    description: 'Reason for lease termination',
    example: 'Tenant requested early termination',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  terminationReason?: string;

  @ApiPropertyOptional({
    description: 'Whether the security deposit has been refunded to the tenant',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  securityDepositRefunded?: boolean;

  @ApiPropertyOptional({
    description: 'Date when the security deposit was refunded',
    example: '2024-12-31T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  securityDepositRefundedDate?: Date;

  @ApiPropertyOptional({
    description: 'Reason or notes for security deposit refund',
    example: 'Full refund - no damages found',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  securityDepositRefundReason?: string;
}
