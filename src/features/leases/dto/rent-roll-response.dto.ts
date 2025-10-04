import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class RentRollItemDto {
  @ApiProperty()
  leaseId: string;

  @ApiProperty()
  propertyId: string;

  @ApiProperty()
  propertyName: string;

  @ApiProperty()
  unitNumber: string;

  @ApiProperty({ required: false })
  propertyImage?: string;

  @ApiProperty()
  tenantName: string;

  @ApiProperty()
  tenantEmail: string;

  @ApiProperty({ required: false })
  tenantPhone?: string;

  @ApiProperty()
  monthlyRent: number;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty({ enum: ['paid', 'partial', 'overdue', 'vacant'] })
  status: 'paid' | 'partial' | 'overdue' | 'vacant';

  @ApiProperty()
  amountCollected: number;

  @ApiProperty()
  outstandingBalance: number;

  @ApiProperty({ required: false })
  lastPaymentDate?: Date;

  @ApiProperty({ required: false })
  paymentMethod?: string;

  @ApiProperty({ required: false })
  daysOverdue?: number;

  @ApiProperty({ required: false })
  lateFees?: number;
}

export class RentRollSummaryDto {
  @ApiProperty({ description: 'Total amount collected for the month' })
  collectedAmount: number;

  @ApiProperty({ description: 'Total outstanding amount from active leases' })
  outstandingAmount: number;

  @ApiProperty({ description: 'Total outstanding amount from non-active leases' })
  outstandingAmountNonActive: number;

  @ApiProperty({ description: 'Collection rate as percentage' })
  collectionRate: number;

  @ApiProperty({ description: 'Number of vacant units' })
  vacantUnits: number;

  @ApiProperty({ description: 'Total number of units' })
  totalUnits: number;
}

export class RentRollMetaDto {
  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  hasNext: boolean;

  @ApiProperty()
  hasPrev: boolean;
}

export class RentRollResponseDto {
  @ApiProperty({ type: RentRollSummaryDto })
  @Type(() => RentRollSummaryDto)
  summary: RentRollSummaryDto;

  @ApiProperty({ type: [RentRollItemDto] })
  @Type(() => RentRollItemDto)
  rentRoll: RentRollItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty({ type: RentRollMetaDto })
  @Type(() => RentRollMetaDto)
  meta: RentRollMetaDto;
}
