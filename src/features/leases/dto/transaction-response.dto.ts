import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Transform, Type } from 'class-transformer';
import { PaymentMethod, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';

export class TransactionLeaseResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty()
  @Expose()
  tenant: {
    _id: string;
    name: string;
  };

  @ApiProperty()
  @Expose()
  unit: {
    _id: string;
    unitNumber: string;
    type: string;
    property: {
      _id: string;
      name: string;
      address: string;
    };
  };
}

export class TransactionRentalPeriodResponseDto {
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

export class TransactionResponseDto {
  @ApiProperty()
  @Expose()
  @Transform(({ obj }) => obj._id.toString())
  id: string;

  @ApiProperty({ type: TransactionLeaseResponseDto })
  @Expose()
  @Type(() => TransactionLeaseResponseDto)
  lease: TransactionLeaseResponseDto;

  @ApiPropertyOptional({ type: TransactionRentalPeriodResponseDto })
  @Expose()
  @Type(() => TransactionRentalPeriodResponseDto)
  rentalPeriod?: TransactionRentalPeriodResponseDto;

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
  paidAt?: Date;

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
  notes?: string;



  @ApiProperty()
  @Expose()
  @Type(() => Date)
  createdAt: Date;

  @ApiProperty()
  @Expose()
  @Type(() => Date)
  updatedAt: Date;
}

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  @Expose()
  @Type(() => TransactionResponseDto)
  data: TransactionResponseDto[];

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

export class TransactionSummaryDto {
  @ApiProperty()
  @Expose()
  totalTransactions: number;

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
