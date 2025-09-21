import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { LeaseStatus, PaymentCycle, RentIncreaseType } from '../../../common/enums/lease.enum';

export class RentIncreaseResponseDto {
  @ApiProperty({
    description: 'Type of rent increase',
    enum: RentIncreaseType,
  })
  @Expose()
  type: RentIncreaseType;

  @ApiProperty({
    description: 'Amount or percentage for rent increase',
  })
  @Expose()
  amount: number;

  @ApiPropertyOptional({
    description: 'Reason for rent increase',
  })
  @Expose()
  reason?: string;
}

export class UnitResponseDto {
  @ApiProperty()
  @Expose()
  _id: string;

  @ApiProperty()
  @Expose()
  unitNumber: string;

  @ApiProperty()
  @Expose()
  type: string;

  @ApiProperty()
  @Expose()
  availabilityStatus: string;
}

export class TenantResponseDto {
  @ApiProperty()
  @Expose()
  _id: string;

  @ApiProperty()
  @Expose()
  name: string;
}

export class PropertyResponseDto {
  @ApiProperty()
  @Expose()
  _id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  address: string;
}

export class LeaseResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty({ type: PropertyResponseDto })
  @Expose()
  @Type(() => PropertyResponseDto)
  property: PropertyResponseDto;

  @ApiProperty({ type: UnitResponseDto })
  @Expose()
  @Type(() => UnitResponseDto)
  unit: UnitResponseDto;

  @ApiProperty({ type: TenantResponseDto })
  @Expose()
  @Type(() => TenantResponseDto)
  tenant: TenantResponseDto;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  startDate: Date;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  endDate: Date;

  @ApiProperty()
  @Expose()
  rentAmount: number;

  @ApiPropertyOptional({
    description: 'Whether a security deposit is required for this lease',
  })
  @Expose()
  isSecurityDeposit?: boolean;

  @ApiPropertyOptional({
    description: 'Security deposit amount',
  })
  @Expose()
  securityDepositAmount?: number;


  @ApiPropertyOptional({
    description: 'Date when the security deposit was refunded',
  })
  @Expose()
  @Type(() => Date)
  securityDepositRefundedAt?: Date;

  @ApiPropertyOptional({
    description: 'Reason or notes for security deposit refund',
  })
  @Expose()
  securityDepositRefundReason?: string;

  @ApiProperty({ enum: PaymentCycle })
  @Expose()
  paymentCycle: PaymentCycle;

  @ApiProperty({ enum: LeaseStatus })
  @Expose()
  status: LeaseStatus;

  @ApiPropertyOptional()
  @Expose()
  terms?: string;

  @ApiPropertyOptional()
  @Expose()
  notes?: string;

  @ApiPropertyOptional({ type: RentIncreaseResponseDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RentIncreaseResponseDto)
  rentIncrease?: RentIncreaseResponseDto;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => Date)
  terminationDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  terminationReason?: string;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export class PaginationMetaDto {
  @ApiProperty()
  @Expose()
  total: number;

  @ApiProperty()
  @Expose()
  page: number;

  @ApiProperty()
  @Expose()
  limit: number;

  @ApiProperty()
  @Expose()
  totalPages: number;

  @ApiProperty()
  @Expose()
  hasNext: boolean;

  @ApiProperty()
  @Expose()
  hasPrev: boolean;
}

export class PaginatedLeasesResponseDto {
  @ApiProperty({ type: [LeaseResponseDto] })
  @Expose()
  @Type(() => LeaseResponseDto)
  data: LeaseResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  @Expose()
  @Type(() => PaginationMetaDto)
  meta: PaginationMetaDto;

  @ApiProperty()
  @Expose()
  success: boolean;
}
