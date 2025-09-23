import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class TerminateLeaseDto {
  @ApiProperty({
    description: 'Date when lease is terminated',
    example: '2024-06-15T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  terminationDate: Date;

  @ApiPropertyOptional({
    description: 'Reason for lease termination',
    example: 'Tenant requested early termination',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  terminationReason?: string;
}

export class RenewLeaseDto {
  @ApiProperty({
    description: 'New lease start date',
    example: '2025-01-01T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({
    description: 'New lease end date',
    example: '2025-12-31T23:59:59.999Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  endDate: Date;


  @ApiPropertyOptional({
    description: 'Notes about the lease renewal',
    example: 'Tenant agreed to 2-year extension',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class ManualRenewLeaseDto {
  @ApiProperty({
    description: 'Desired lease end date (will be extended to complete the payment cycle)',
    example: '2025-12-15T00:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  @IsNotEmpty()
  desiredEndDate: Date;

  @ApiPropertyOptional({
    description: 'Notes about the lease renewal',
    example: 'Tenant agreed to extension',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
