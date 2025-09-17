import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { RentIncreaseDto } from './create-lease.dto';

export class TerminateLeaseDto {
  @ApiPropertyOptional({
    description: 'Date when lease is terminated',
    example: '2024-06-15T00:00:00.000Z',
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  terminationDate?: Date;

  @ApiProperty({
    description: 'Reason for lease termination',
    example: 'Tenant requested early termination',
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  terminationReason: string;
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
    description: 'New rent amount (if different from current)',
    example: 1350,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rentAmount?: number;

  @ApiPropertyOptional({
    description: 'Rent increase details for renewal',
    type: RentIncreaseDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentIncreaseDto)
  rentIncrease?: RentIncreaseDto;

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
