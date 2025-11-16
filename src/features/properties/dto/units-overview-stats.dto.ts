import { ApiProperty } from '@nestjs/swagger';

export class UnitsOverviewStatsDto {
  @ApiProperty({ example: 100 })
  totalUnits: number;

  @ApiProperty({ example: 75 })
  occupiedUnits: number;

  @ApiProperty({ example: 25 })
  availableUnits: number;

  @ApiProperty({ example: 75 })
  occupancyRate: number;

  @ApiProperty({ example: 75000 })
  totalMonthlyRevenue: number;
}

export class UnitsOverviewStatsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: UnitsOverviewStatsDto })
  data: UnitsOverviewStatsDto;
}
