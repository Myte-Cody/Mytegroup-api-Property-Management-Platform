import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';

export class RevenuePropertyResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  address: string;
}

export class RevenueUnitResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @ApiProperty()
  @Expose()
  unitNumber: string;

  @ApiProperty()
  @Expose()
  type: string;
}

export class RevenueTenantResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiPropertyOptional()
  @Expose()
  email?: string;

  @ApiPropertyOptional()
  @Expose()
  phone?: string;
}

export class RevenueLeaseResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id?.toString())
  id: string;

  @ApiPropertyOptional({ type: RevenueTenantResponseDto })
  @Expose()
  @Type(() => RevenueTenantResponseDto)
  tenant?: RevenueTenantResponseDto;
}

export class RevenueResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiPropertyOptional({ type: RevenuePropertyResponseDto })
  @Expose()
  @Type(() => RevenuePropertyResponseDto)
  property?: RevenuePropertyResponseDto;

  @ApiPropertyOptional({ type: RevenueUnitResponseDto })
  @Expose()
  @Type(() => RevenueUnitResponseDto)
  unit?: RevenueUnitResponseDto;

  @ApiPropertyOptional({ type: RevenueLeaseResponseDto })
  @Expose()
  @Type(() => RevenueLeaseResponseDto)
  lease?: RevenueLeaseResponseDto;

  @ApiPropertyOptional({ type: RevenueTenantResponseDto })
  @Expose()
  @Type(() => RevenueTenantResponseDto)
  @Transform(({ obj }) => {
    if (obj.lease && typeof obj.lease === 'object' && obj.lease.tenant) {
      return obj.lease.tenant;
    }
    return undefined;
  })
  tenant?: RevenueTenantResponseDto;

  @ApiProperty({ enum: PaymentType, description: 'Transaction type' })
  @Expose()
  type: PaymentType;

  @ApiProperty({ description: 'Total amount due for this transaction' })
  @Expose()
  @Transform(({ obj }) => obj.amount)
  amount_due: number;

  @ApiProperty({ description: 'Amount paid (0 if not paid)' })
  @Expose()
  @Transform(({ obj }) => (obj.status === PaymentStatus.PAID ? obj.amount : 0))
  amount_paid: number;

  @ApiProperty({ enum: PaymentStatus })
  @Expose()
  status: PaymentStatus;

  @ApiProperty({ description: 'Due date for the transaction' })
  @Expose()
  @Type(() => Date)
  @Transform(({ obj }) => obj.dueDate)
  date: Date;

  @ApiPropertyOptional({ description: 'Transaction description/notes' })
  @Expose()
  @Transform(({ obj }) => obj.notes)
  description?: string;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => Date)
  paidAt?: Date;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @Expose()
  paymentMethod?: PaymentMethod;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export class PaginatedRevenuesResponseDto {
  @ApiProperty({ type: [RevenueResponseDto] })
  @Expose()
  @Type(() => RevenueResponseDto)
  data: RevenueResponseDto[];

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

export class RevenueSummaryDto {
  @ApiProperty()
  @Expose()
  totalTransactions: number;

  @ApiProperty()
  @Expose()
  totalRevenue: number;

  @ApiProperty()
  @Expose()
  pendingRevenue: number;

  @ApiProperty()
  @Expose()
  overdueRevenue: number;

  @ApiProperty()
  @Expose()
  byType: {
    [key: string]: number;
  };
}
