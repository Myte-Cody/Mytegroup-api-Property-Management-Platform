import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ExpenseCategory } from '../../../features/expenses/schemas/expense.schema';

export enum AggregationScope {
  PORTFOLIO = 'portfolio',
  PROPERTY = 'property',
  UNIT = 'unit',
}

export enum PeriodType {
  THIS_MONTH = 'this-month',
  LAST_MONTH = 'last-month',
  YEAR_TO_DATE = 'year-to-date',
  ROLLING_12_MONTHS = 'rolling-12-months',
  CUSTOM = 'custom',
}

export enum RevenueType {
  RENT = 'rent',
  DEPOSIT = 'deposit',
  FEES = 'fees',
  UTILITIES = 'utilities',
  OTHER = 'other',
}

export enum TransactionStatus {
  CONFIRMED = 'confirmed',
  PAID = 'paid',
  PENDING = 'pending',
}

export class FinancialKPIQueryDto {
  @ApiProperty({
    enum: AggregationScope,
    description: 'Aggregation level for KPIs',
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
    enum: RevenueType,
    description: 'Filter revenue by type',
  })
  @IsOptional()
  @IsEnum(RevenueType)
  revenueType?: RevenueType;

  @ApiPropertyOptional({
    enum: ExpenseCategory,
    description: 'Filter expenses by category',
  })
  @IsOptional()
  @IsEnum(ExpenseCategory)
  expenseCategory?: ExpenseCategory;

  @ApiPropertyOptional({
    enum: TransactionStatus,
    isArray: true,
    description: 'Filter by transaction status',
  })
  @IsOptional()
  @IsEnum(TransactionStatus, { each: true })
  status?: TransactionStatus[];

  @ApiPropertyOptional({
    description: 'Enable period comparison',
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  compare?: boolean;
}

export class RevenueBreakdownDto {
  type: string;
  amount: number;
  percentage: number;
}

export class ExpenseBreakdownDto {
  category: string;
  amount: number;
  percentage: number;
}

export class MonthlyDataDto {
  month: string; // YYYY-MM
  revenue: number;
  expense: number;
  noi: number;
}

export class RevenueShareDto {
  entityId: string;
  entityName: string;
  entityType: 'property' | 'unit';
  revenue: number;
  percentage: number;
}

export class ExpenseShareDto {
  entityId: string;
  entityName: string;
  entityType: 'property' | 'unit';
  expense: number;
  percentage: number;
}

export class PeriodDataDto {
  totalRevenue: number;
  totalExpenses: number;
  netOperatingIncome: number;
  revenueGrowthRate?: number;
  expenseToRevenueRatio: number;
}

export class FinancialKPIResponseDto {
  current: PeriodDataDto;
  previous?: PeriodDataDto;
  revenueBreakdown: RevenueBreakdownDto[];
  expenseBreakdown: ExpenseBreakdownDto[];
  monthlyTrend: MonthlyDataDto[];
  revenueShare: RevenueShareDto[];
  expenseShare: ExpenseShareDto[];
  maintenanceCost: number;
}
