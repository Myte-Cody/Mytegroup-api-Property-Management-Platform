import { ApiProperty } from '@nestjs/swagger';
import { UnitAvailabilityStatus, UnitType } from '../../../common/enums/unit.enum';

export class UnitTypeCount {
  @ApiProperty({ example: 'APARTMENT', enum: UnitType })
  type: UnitType;

  @ApiProperty({ example: 5 })
  count: number;
}

export class UnitStatusCount {
  @ApiProperty({ example: 'OCCUPIED', enum: UnitAvailabilityStatus })
  status: UnitAvailabilityStatus;

  @ApiProperty({ example: 10 })
  count: number;
}

export class PropertyStatisticsDto {
  @ApiProperty({ example: '60d5f1d0e4b0a1234567890a' })
  propertyId: string;

  @ApiProperty({ example: 20 })
  totalUnits: number;

  @ApiProperty({ example: 15 })
  occupiedUnits: number;

  @ApiProperty({ example: 5 })
  vacantUnits: number;

  @ApiProperty({ example: 75 })
  occupancyRate: number;

  @ApiProperty({ example: 15000 })
  totalMonthlyRevenue: number;

  @ApiProperty({ example: 1000 })
  averageMonthlyRent: number;

  @ApiProperty({ type: [UnitTypeCount] })
  unitsByType: UnitTypeCount[];

  @ApiProperty({ type: [UnitStatusCount] })
  unitsByStatus: UnitStatusCount[];
}
