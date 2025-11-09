import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, ValidateIf } from 'class-validator';

export enum OccupancyScope {
  PORTFOLIO = 'portfolio',
  PROPERTY = 'property',
}

export enum OccupancyPeriodType {
  THIS_MONTH = 'this-month',
  LAST_MONTH = 'last-month',
  YEAR_TO_DATE = 'year-to-date',
  ROLLING_12_MONTHS = 'rolling-12-months',
  CUSTOM = 'custom',
}

export class OccupancyLeasingKPIQueryDto {
  @ApiProperty({
    enum: OccupancyScope,
    description:
      'Scope of the KPI report - Portfolio level (all properties) or Property level (specific property)',
    example: 'portfolio',
  })
  @IsEnum(OccupancyScope)
  scope: OccupancyScope;

  @ApiPropertyOptional({
    description:
      'Property ID - Required when scope is "property", filters KPIs to a specific property',
    example: '507f1f77bcf86cd799439011',
  })
  @ValidateIf((o) => o.scope === OccupancyScope.PROPERTY)
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description:
      'Tenant ID - Optional filter to show KPIs for a specific tenant across selected scope',
    example: '507f1f77bcf86cd799439012',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    enum: OccupancyPeriodType,
    description:
      'Time period for KPI calculation - Options: This Month, Last Month, Year to Date, Rolling 12 Months, or Custom Range',
    example: 'this-month',
  })
  @IsEnum(OccupancyPeriodType)
  period: OccupancyPeriodType;

  @ApiPropertyOptional({
    description:
      'Custom period start date - Required when period is "custom", must be in ISO 8601 format',
    example: '2024-01-01',
  })
  @ValidateIf((o) => o.period === OccupancyPeriodType.CUSTOM)
  @IsDateString()
  customStartDate?: string;

  @ApiPropertyOptional({
    description:
      'Custom period end date - Required when period is "custom", must be in ISO 8601 format',
    example: '2024-12-31',
  })
  @ValidateIf((o) => o.period === OccupancyPeriodType.CUSTOM)
  @IsDateString()
  customEndDate?: string;

  @ApiPropertyOptional({
    description:
      'Enable comparison with previous period - When enabled, response includes previous period data for trend analysis',
    default: false,
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  compare?: boolean;
}

// Occupancy & Utilization Section
export class OccupancyRateDto {
  /**
   * Occupancy rate percentage
   * Calculation: (OccupiedUnits / TotalUnits) × 100
   */
  rate: number;

  /**
   * Number of currently occupied units
   */
  occupiedUnits: number;

  /**
   * Total number of rentable units
   */
  totalUnits: number;

  /**
   * Graphical data for visual representation
   */
  graphicalData: { label: string; value: number }[];
}

export class VacancyRateDto {
  /**
   * Vacancy rate percentage
   * Calculation: (VacantUnits / TotalUnits) × 100
   */
  rate: number;

  /**
   * Number of currently vacant units
   */
  vacantUnits: number;

  /**
   * Total number of rentable units
   */
  totalUnits: number;

  /**
   * Graphical data for visual representation
   */
  graphicalData: { label: string; value: number }[];
}

export class OccupancyUtilizationDto {
  /**
   * Percentage of rentable units currently occupied
   * Numeric and graphical metric
   */
  occupancyRate: OccupancyRateDto;

  /**
   * Percentage of units not occupied
   * Numeric and graphical metric
   */
  vacancyRate: VacancyRateDto;

  /**
   * Average duration of tenant stays in days
   * Numeric metric
   * Calculation: Mean of (lease_end_date - lease_start_date) for active leases
   */
  averageOccupancyDuration: number;

  /**
   * Change in occupancy compared to previous period (percentage)
   * Numeric metric
   * Calculation: ((Occupancy_Current - Occupancy_Previous) / Occupancy_Previous) × 100
   * Only available when comparison is enabled
   */
  occupancyGrowthRate?: number;
}

// Leasing Activity Section
export class LeaseRenewalRateDto {
  /**
   * Lease renewal rate percentage
   * Calculation: (RenewedLeases / ExpiringLeases) × 100
   */
  rate: number;

  /**
   * Number of leases that were renewed
   */
  renewedLeases: number;

  /**
   * Number of leases that were expiring in the period
   */
  expiringLeases: number;

  /**
   * Graphical data for visual representation
   */
  graphicalData: { label: string; value: number }[];
}

export class LeasingActivityDto {
  /**
   * Leases that started in the selected period
   * Numeric metric
   * Calculation: Count of leases with start_date in period
   */
  newLeasesSigned: number;

  /**
   * Leases that ended in the selected period
   * Numeric metric
   * Calculation: Count of leases with end_date in period
   */
  terminatedLeases: number;

  /**
   * Percentage of expiring leases renewed
   * Numeric and graphical metric
   */
  leaseRenewalRate: LeaseRenewalRateDto;

  /**
   * Average days a unit stays vacant before new lease
   * Numeric metric
   * Calculation: Mean of (new_lease_start_date - previous_lease_end_date)
   */
  averageVacancyDuration: number;

  /**
   * Percentage of units that changed tenants in the selected period
   * Numeric metric
   * Calculation: (LeasesTerminated / TotalUnits) × 100
   */
  turnoverRate: number;
}

// Period Data Structure
export class OccupancyLeasingPeriodDto {
  occupancyUtilization: OccupancyUtilizationDto;
  leasingActivity: LeasingActivityDto;
}

// Main Response DTO
export class OccupancyLeasingKPIResponseDto {
  current: OccupancyLeasingPeriodDto;
  previous?: OccupancyLeasingPeriodDto;
}
