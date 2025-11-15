import { ApiProperty } from '@nestjs/swagger';

export class UnitStatsDto {
  @ApiProperty({
    description: 'Unit ID',
    example: '507f1f77bcf86cd799439011',
  })
  unitId: string;

  @ApiProperty({
    description: 'Year-to-date revenue for this unit',
    example: 22400,
  })
  ytdRevenue: number;

  @ApiProperty({
    description: 'Number of open maintenance requests',
    example: 2,
  })
  maintenanceRequestsCount: number;

  @ApiProperty({
    description: 'Current balance (positive means tenant owes money)',
    example: 0,
  })
  currentBalance: number;

  @ApiProperty({
    description: 'Last payment date',
    example: '2024-01-01',
    nullable: true,
  })
  lastPaymentDate: string | null;

  @ApiProperty({
    description: 'Next payment due date',
    example: '2024-02-01',
    nullable: true,
  })
  nextPaymentDue: string | null;
}

export class UnitStatsResponseDto {
  @ApiProperty({ description: 'Success status' })
  success: boolean;

  @ApiProperty({ type: UnitStatsDto })
  data: UnitStatsDto;
}
