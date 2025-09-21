import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { RentIncreaseType, RentalPeriodStatus } from '../../../common/enums/lease.enum';

export class AppliedRentIncreaseResponseDto {
  @ApiProperty({ enum: RentIncreaseType })
  @Expose()
  type: RentIncreaseType;

  @ApiProperty()
  @Expose()
  amount: number;

  @ApiProperty()
  @Expose()
  previousRent: number;

  @ApiPropertyOptional()
  @Expose()
  reason?: string;
}

export class RentalPeriodLeaseResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty()
  @Expose()
  unit: {
    _id: string;
    unitNumber: string;
    type: string;
  };

  @ApiProperty()
  @Expose()
  tenant: {
    _id: string;
    name: string;
  };

  @ApiProperty()
  @Expose()
  property: {
    _id: string;
    name: string;
    address: string;
  };

  @ApiPropertyOptional()
  @Expose()
  terms?: string;
}

export class RentalPeriodResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty({ type: RentalPeriodLeaseResponseDto })
  @Expose()
  @Type(() => RentalPeriodLeaseResponseDto)
  lease: RentalPeriodLeaseResponseDto;

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

  @ApiProperty({ enum: RentalPeriodStatus })
  @Expose()
  status: RentalPeriodStatus;

  @ApiPropertyOptional({ type: AppliedRentIncreaseResponseDto })
  @Expose()
  @Type(() => AppliedRentIncreaseResponseDto)
  appliedRentIncrease?: AppliedRentIncreaseResponseDto;


  @ApiPropertyOptional()
  @Expose()
  @Transform(({ obj }) => obj.renewedFrom?.toString())
  renewedFromId?: string;

  @ApiPropertyOptional()
  @Expose()
  @Transform(({ obj }) => obj.renewedTo?.toString())
  renewedToId?: string;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export class PaginatedRentalPeriodsResponseDto {
  @ApiProperty({ type: [RentalPeriodResponseDto] })
  @Expose()
  @Type(() => RentalPeriodResponseDto)
  data: RentalPeriodResponseDto[];

  @ApiProperty()
  @Expose()
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  @ApiProperty()
  @Expose()
  success: boolean;
}

export class RentHistoryPeriodDto {
  @ApiProperty()
  @Expose()
  period: string;

  @ApiProperty()
  @Expose()
  rentAmount: number;

  @ApiProperty({ enum: RentalPeriodStatus })
  @Expose()
  status: RentalPeriodStatus;

  @ApiPropertyOptional({ type: AppliedRentIncreaseResponseDto })
  @Expose()
  @Type(() => AppliedRentIncreaseResponseDto)
  appliedRentIncrease?: AppliedRentIncreaseResponseDto;

  @ApiProperty()
  @Expose()
  calculatedIncrease: {
    amount: number;
    percentage: number;
  };
}

export class RentHistoryResponseDto {
  @ApiProperty()
  @Expose()
  leaseId: string;

  @ApiProperty()
  @Expose()
  totalPeriods: number;

  @ApiProperty()
  @Expose()
  currentRent: number;

  @ApiProperty()
  @Expose()
  originalRent: number;

  @ApiProperty()
  @Expose()
  totalIncrease: number;

  @ApiProperty({ type: [RentHistoryPeriodDto] })
  @Expose()
  @Type(() => RentHistoryPeriodDto)
  history: RentHistoryPeriodDto[];
}
