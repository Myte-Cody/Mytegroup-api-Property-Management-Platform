import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TicketCategory, TicketStatus } from '../../../common/enums/maintenance.enum';
import { AggregationScope, PeriodType } from './financial-kpi.dto';

export enum CreatorType {
  ALL = 'all',
  TENANT = 'tenant',
  LANDLORD = 'landlord',
}

export class MaintenanceKPIQueryDto {
  @ApiProperty({
    enum: AggregationScope,
    description: 'Aggregation level for KPIs (portfolio, property, or unit)',
  })
  @IsEnum(AggregationScope)
  scope: AggregationScope;

  @ApiPropertyOptional({
    description: 'Property ID (required when scope is property or unit)',
  })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiPropertyOptional({
    description: 'Unit ID (required when scope is unit)',
  })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Tenant ID to filter tickets created by specific tenant',
  })
  @IsOptional()
  @IsString()
  tenantId?: string;

  @ApiProperty({
    enum: CreatorType,
    description: 'Filter tickets by creator type (all, tenant, or landlord)',
    default: CreatorType.ALL,
  })
  @IsEnum(CreatorType)
  creator: CreatorType;

  @ApiProperty({
    enum: PeriodType,
    description: 'Period type for KPI calculation',
  })
  @IsEnum(PeriodType)
  period: PeriodType;

  @ApiPropertyOptional({
    description: 'Custom period start date (required when period is custom)',
  })
  @IsOptional()
  @IsDateString()
  customStartDate?: string;

  @ApiPropertyOptional({
    description: 'Custom period end date (required when period is custom)',
  })
  @IsOptional()
  @IsDateString()
  customEndDate?: string;

  @ApiPropertyOptional({
    enum: TicketCategory,
    isArray: true,
    description: 'Filter tickets by category',
  })
  @IsOptional()
  @IsEnum(TicketCategory, { each: true })
  categories?: TicketCategory[];

  @ApiPropertyOptional({
    enum: TicketStatus,
    isArray: true,
    description: 'Filter tickets by status',
  })
  @IsOptional()
  @IsEnum(TicketStatus, { each: true })
  statuses?: TicketStatus[];

  @ApiPropertyOptional({
    description: 'Contractor ID to filter tickets assigned to specific contractor',
  })
  @IsOptional()
  @IsString()
  contractorId?: string;

  @ApiPropertyOptional({
    description: 'Enable period comparison',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  compare?: boolean;
}

export class CategoryBreakdownDto {
  category: string;
  count: number;
  percentage: number;
  avgResolutionTime?: number; // in hours
}

export class StatusBreakdownDto {
  status: string;
  count: number;
  percentage: number;
}

export class ContractorPerformanceDto {
  contractorId: string;
  contractorName: string;
  ticketsAssigned: number;
  ticketsCompleted: number;
  avgResolutionTime: number; // in hours
  completionRate: number; // percentage
}

export class PropertyMaintenanceShareDto {
  entityId: string;
  entityName: string;
  entityType: 'property' | 'unit';
  ticketCount: number;
  percentage: number;
}

export class MonthlyTicketTrendDto {
  month: string; // YYYY-MM
  opened: number;
  closed: number;
  inProgress: number;
}

export class MaintenancePeriodDataDto {
  totalTickets: number;
  openTickets: number;
  inProgressTickets: number;
  closedTickets: number;
  avgResolutionTime: number; // in hours
  ticketGrowthRate?: number; // percentage, only when comparing
}

export class MaintenanceKPIResponseDto {
  current: MaintenancePeriodDataDto;
  previous?: MaintenancePeriodDataDto;
  categoryBreakdown: CategoryBreakdownDto[];
  statusBreakdown: StatusBreakdownDto[];
  contractorPerformance: ContractorPerformanceDto[];
  monthlyTrend: MonthlyTicketTrendDto[];
  propertyShare: PropertyMaintenanceShareDto[];
}

// Ticket & Work Volume DTOs
export class GraphicalDataDto {
  label: string;
  value: number;
}

export class TicketsByCreatorDto {
  tenantPercentage: number;
  landlordPercentage: number;
  tenantCount: number;
  landlordCount: number;
  graphicalData: GraphicalDataDto[];
}

export class TicketWorkVolumePeriodDto {
  totalTickets: number;
  ticketsByCreator: TicketsByCreatorDto;
  standaloneTicketsPercentage: number;
  standaloneTicketsCount: number;
  propertyWideTicketsPercentage: number;
  propertyWideTicketsCount: number;
  totalSOWs: number;
  closedSOWs: number;
  totalSubSOWs: number;
  closedSubSOWs: number;
  subSOWsPerSOW: number;
}

export class TicketWorkVolumeKPIResponseDto {
  current: TicketWorkVolumePeriodDto;
  previous?: TicketWorkVolumePeriodDto;
}

// Maintenance Cost & Invoicing DTOs
export class MaintenanceCostPeriodDto {
  totalMaintenanceCost: number;
  averageCostPerJob: number;
  invoicesPendingConfirmation: number;
  confirmedInvoices: number;
  propertyWideCostSharePercentage: number;
  propertyWideCostAmount: number;
  closedJobsCount: number; // Total closed tickets + SOWs + Sub-SOWs for context
}

export class MaintenanceCostInvoicingKPIResponseDto {
  current: MaintenanceCostPeriodDto;
  previous?: MaintenanceCostPeriodDto;
}

// Resolution & Completion DTOs
export class ResolutionCompletionPeriodDto {
  closedTickets: number;
  reopenedTicketsPercentage: number;
  reopenedTicketsCount: number;
  totalTicketsCount: number;
  sowCompletionRate: number;
  closedSOWsCount: number;
  totalSOWsCount: number;
  subSOWCompletionRate: number;
  closedSubSOWsCount: number;
  totalSubSOWsCount: number;
}

export class ResolutionCompletionKPIResponseDto {
  current: ResolutionCompletionPeriodDto;
  previous?: ResolutionCompletionPeriodDto;
}
