import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import {
  PaymentMethod,
  PaymentStatus,
  PaymentType,
} from '../../../common/enums/lease.enum';

export class PaymentLeaseResponseDto {
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
}

export class PaymentRentalPeriodResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

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
}

export class PaymentResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty({ type: PaymentLeaseResponseDto })
  @Expose()
  @Type(() => PaymentLeaseResponseDto)
  lease: PaymentLeaseResponseDto;

  @ApiPropertyOptional({ type: PaymentRentalPeriodResponseDto })
  @Expose()
  @Type(() => PaymentRentalPeriodResponseDto)
  rentalPeriod?: PaymentRentalPeriodResponseDto;

  @ApiProperty()
  @Expose()
  amount: number;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  dueDate: Date;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => Date)
  paymentDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => Date)
  paidDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => Date)
  processedDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  @Type(() => Date)
  refundDate?: Date;

  @ApiPropertyOptional()
  @Expose()
  refundAmount?: number;

  @ApiPropertyOptional()
  @Expose()
  refundReason?: string;

  @ApiProperty({ enum: PaymentStatus })
  @Expose()
  status: PaymentStatus;

  @ApiProperty({ enum: PaymentType })
  @Expose()
  type: PaymentType;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @Expose()
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional()
  @Expose()
  transactionReference?: string;

  @ApiPropertyOptional()
  @Expose()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Whether the payment has been validated by the landlord',
  })
  @Expose()
  landlordValidated?: boolean;

  @ApiPropertyOptional({
    description: 'Date when the payment was validated by the landlord',
  })
  @Expose()
  @Type(() => Date)
  landlordValidatedDate?: Date;

  @ApiPropertyOptional({
    description: 'Notes from the landlord about the payment validation',
  })
  @Expose()
  landlordNotes?: string;

  @ApiPropertyOptional({
    description: 'Notes from the tenant about the payment',
  })
  @Expose()
  tenantNotes?: string;

  @ApiPropertyOptional({
    description: 'Auto-generated payment reference',
  })
  @Expose()
  reference?: string;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export class PaginatedPaymentsResponseDto {
  @ApiProperty({ type: [PaymentResponseDto] })
  @Expose()
  @Type(() => PaymentResponseDto)
  data: PaymentResponseDto[];

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

export class PaymentSummaryDto {
  @ApiProperty()
  @Expose()
  totalPayments: number;

  @ApiProperty()
  @Expose()
  totalAmount: number;

  @ApiProperty()
  @Expose()
  processedAmount: number;

  @ApiProperty()
  @Expose()
  pendingAmount: number;

  @ApiProperty()
  @Expose()
  refundedAmount: number;

  @ApiProperty()
  @Expose()
  byType: {
    rent: number;
    deposit: number;
    fees: number;
    utilities: number;
    maintenance: number;
    other: number;
  };

  @ApiProperty()
  @Expose()
  byStatus: {
    pending: number;
    processed: number;
    failed: number;
    refunded: number;
  };
}