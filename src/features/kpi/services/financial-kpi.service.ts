import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { endOfMonth, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { Model, Types } from 'mongoose';
import { PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { InvoiceStatus } from '../../../common/enums/maintenance.enum';
import { Expense, ExpenseStatus } from '../../expenses/schemas/expense.schema';
import { Transaction } from '../../leases/schemas/transaction.schema';
import { Invoice } from '../../maintenance/schemas/invoice.schema';
import { MaintenanceTicket } from '../../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../../maintenance/schemas/scope-of-work.schema';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import {
  AggregationScope,
  ExpenseBreakdownDto,
  ExpenseShareDto,
  FinancialKPIQueryDto,
  FinancialKPIResponseDto,
  MonthlyDataDto,
  PeriodDataDto,
  PeriodType,
  RevenueBreakdownDto,
  RevenueShareDto,
  RevenueType,
  TransactionStatus,
} from '../dto/financial-kpi.dto';

interface PeriodDates {
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class FinancialKPIService {
  constructor(
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Unit.name) private unitModel: Model<Unit>,
    @InjectModel(Invoice.name) private invoiceModel: Model<Invoice>,
    @InjectModel(MaintenanceTicket.name) private maintenanceTicketModel: Model<MaintenanceTicket>,
    @InjectModel(ScopeOfWork.name) private scopeOfWorkModel: Model<ScopeOfWork>,
  ) {}

  async getFinancialKPIs(query: FinancialKPIQueryDto): Promise<FinancialKPIResponseDto> {
    // Get period dates
    const currentPeriod = this.getPeriodDates(
      query.period,
      query.customStartDate,
      query.customEndDate,
    );
    const previousPeriod = query.compare
      ? this.getPreviousPeriod(currentPeriod, query.period)
      : null;

    // Build base match filters
    const baseMatchFilters = await this.buildMatchFilters(query);

    // Calculate current period KPIs
    const currentData = await this.calculatePeriodData(baseMatchFilters, currentPeriod, query);

    // Calculate previous period KPIs if comparison is enabled
    let previousData: PeriodDataDto | undefined;
    if (previousPeriod) {
      previousData = await this.calculatePeriodData(baseMatchFilters, previousPeriod, query);

      // Calculate growth rate
      currentData.revenueGrowthRate = this.calculateGrowthRate(
        currentData.totalRevenue,
        previousData.totalRevenue,
      );
    }

    // Get detailed breakdowns and trends
    const [
      revenueBreakdown,
      expenseBreakdown,
      monthlyTrend,
      revenueShare,
      expenseShare,
      maintenanceCost,
    ] = await Promise.all([
      this.getRevenueBreakdown(baseMatchFilters, currentPeriod, query.revenueType),
      this.getExpenseBreakdown(baseMatchFilters, currentPeriod, query.expenseCategory),
      this.getMonthlyTrend(baseMatchFilters, currentPeriod),
      this.getRevenueShare(query.scope, currentPeriod, baseMatchFilters),
      this.getExpenseShare(query.scope, currentPeriod, baseMatchFilters),
      this.getMaintenanceCost(baseMatchFilters, currentPeriod),
    ]);

    return {
      current: currentData,
      previous: previousData,
      revenueBreakdown,
      expenseBreakdown,
      monthlyTrend,
      revenueShare,
      expenseShare,
      maintenanceCost,
    };
  }

  private getPeriodDates(
    periodType: PeriodType,
    customStartDate?: string,
    customEndDate?: string,
  ): PeriodDates {
    const now = new Date();

    switch (periodType) {
      case PeriodType.THIS_MONTH:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };

      case PeriodType.LAST_MONTH: {
        const lastMonth = subMonths(now, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
        };
      }

      case PeriodType.YEAR_TO_DATE:
        return {
          startDate: startOfYear(now),
          endDate: now,
        };

      case PeriodType.ROLLING_12_MONTHS: {
        const twelveMonthsAgo = subMonths(now, 12);
        return {
          startDate: startOfMonth(twelveMonthsAgo),
          endDate: endOfMonth(now),
        };
      }

      case PeriodType.CUSTOM:
        if (!customStartDate || !customEndDate) {
          // If custom dates are not provided, default to current month
          return {
            startDate: startOfMonth(now),
            endDate: endOfMonth(now),
          };
        }
        return {
          startDate: new Date(customStartDate),
          endDate: new Date(customEndDate),
        };

      default:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };
    }
  }

  private getPreviousPeriod(current: PeriodDates, periodType: PeriodType): PeriodDates {
    switch (periodType) {
      case PeriodType.THIS_MONTH:
      case PeriodType.LAST_MONTH: {
        const prevMonth = subMonths(current.startDate, 1);
        return {
          startDate: startOfMonth(prevMonth),
          endDate: endOfMonth(prevMonth),
        };
      }

      case PeriodType.YEAR_TO_DATE: {
        const lastYear = new Date(current.startDate);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        const lastYearSameDay = new Date(current.endDate);
        lastYearSameDay.setFullYear(lastYearSameDay.getFullYear() - 1);
        return {
          startDate: lastYear,
          endDate: lastYearSameDay,
        };
      }

      case PeriodType.ROLLING_12_MONTHS: {
        const durationMs = current.endDate.getTime() - current.startDate.getTime();
        return {
          startDate: new Date(current.startDate.getTime() - durationMs),
          endDate: new Date(current.endDate.getTime() - durationMs),
        };
      }

      case PeriodType.CUSTOM: {
        const durationMs = current.endDate.getTime() - current.startDate.getTime();
        return {
          startDate: new Date(current.startDate.getTime() - durationMs),
          endDate: new Date(current.endDate.getTime() - durationMs),
        };
      }

      default:
        const prevMonth = subMonths(current.startDate, 1);
        return {
          startDate: startOfMonth(prevMonth),
          endDate: endOfMonth(prevMonth),
        };
    }
  }

  private async buildMatchFilters(query: FinancialKPIQueryDto): Promise<any> {
    const filters: any = {
      scope: query.scope,
      propertyId: query.propertyId,
      unitId: query.unitId,
    };

    // For portfolio scope, get all properties
    if (query.scope === AggregationScope.PORTFOLIO) {
      const properties = await this.propertyModel.find().select('_id');
      filters.properties = properties.map((p) => p._id);
    }

    return filters;
  }

  private mapStatusToPaymentStatus(status: TransactionStatus[]): PaymentStatus[] {
    return status.map((s) => {
      switch (s) {
        case TransactionStatus.PAID:
          return PaymentStatus.PAID;
        case TransactionStatus.PENDING:
          return PaymentStatus.PENDING;
        case TransactionStatus.CONFIRMED:
          return PaymentStatus.PAID; // Treating confirmed as paid
        default:
          return PaymentStatus.PENDING;
      }
    });
  }

  private async calculatePeriodData(
    baseFilters: any,
    period: PeriodDates,
    query: FinancialKPIQueryDto,
  ): Promise<PeriodDataDto> {
    // Build revenue aggregation pipeline with lease lookup
    const revenuePipeline = this.buildTransactionPipeline(baseFilters, period, query);

    // Build expense match with property filtering
    const expensePipeline = this.buildExpensePipeline(baseFilters, period, query);

    // Get invoices and calculate invoice expenses
    const invoiceExpenses = await this.calculateInvoiceExpenses(baseFilters, period, query);

    // Calculate totals
    const [revenueResult, expenseResult] = await Promise.all([
      this.transactionModel.aggregate(revenuePipeline),
      this.expenseModel.aggregate(expensePipeline),
    ]);

    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;
    const totalExpenses = (expenseResult.length > 0 ? expenseResult[0].total : 0) + invoiceExpenses;
    const netOperatingIncome = totalRevenue - totalExpenses;
    const expenseToRevenueRatio = totalRevenue > 0 ? (totalExpenses / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalExpenses,
      netOperatingIncome,
      expenseToRevenueRatio,
    };
  }

  private buildTransactionPipeline(
    baseFilters: any,
    period: PeriodDates,
    query: FinancialKPIQueryDto,
  ): any[] {
    const pipeline: any[] = [];

    // Match by date and status
    const match: any = {
      dueDate: { $gte: period.startDate, $lte: period.endDate },
    };

    if (query.status && query.status.length > 0) {
      match.status = { $in: this.mapStatusToPaymentStatus(query.status) };
    } else {
      match.status = PaymentStatus.PAID;
    }

    if (query.revenueType) {
      match.type = this.mapRevenueTypeToPaymentType(query.revenueType);
    }

    pipeline.push({ $match: match });

    // Lookup lease to get unit and property information
    pipeline.push({
      $lookup: {
        from: 'leases',
        localField: 'lease',
        foreignField: '_id',
        as: 'leaseData',
      },
    });

    // Lookup unit from lease
    pipeline.push({
      $lookup: {
        from: 'units',
        localField: 'leaseData.unit',
        foreignField: '_id',
        as: 'unitFromLease',
      },
    });

    // Add computed fields for property and unit
    pipeline.push({
      $addFields: {
        computedProperty: {
          $cond: {
            if: { $ne: ['$property', null] },
            then: '$property',
            else: { $arrayElemAt: ['$unitFromLease.property', 0] },
          },
        },
        computedUnit: {
          $cond: {
            if: { $ne: ['$unit', null] },
            then: '$unit',
            else: { $arrayElemAt: ['$leaseData.unit', 0] },
          },
        },
      },
    });

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          computedProperty: { $in: baseFilters.properties },
        },
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      pipeline.push({
        $match: {
          computedProperty: new Types.ObjectId(baseFilters.propertyId),
        },
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      pipeline.push({
        $match: {
          computedUnit: new Types.ObjectId(baseFilters.unitId),
        },
      });
    }

    // Group and sum
    pipeline.push({
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    });

    return pipeline;
  }

  private buildExpensePipeline(
    baseFilters: any,
    period: PeriodDates,
    query: FinancialKPIQueryDto,
  ): any[] {
    const pipeline: any[] = [];

    // Match by date and status
    const match: any = {
      date: { $gte: period.startDate, $lte: period.endDate },
    };

    if (query.status && query.status.length > 0) {
      const includeConfirmed =
        query.status.includes(TransactionStatus.CONFIRMED) ||
        query.status.includes(TransactionStatus.PAID);
      if (includeConfirmed) {
        match.status = ExpenseStatus.CONFIRMED;
      }
    } else {
      match.status = ExpenseStatus.CONFIRMED;
    }

    if (query.expenseCategory) {
      match.category = query.expenseCategory;
    }

    pipeline.push({ $match: match });

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          property: { $in: baseFilters.properties },
        },
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      pipeline.push({
        $match: {
          property: new Types.ObjectId(baseFilters.propertyId),
        },
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      pipeline.push({
        $match: {
          unit: new Types.ObjectId(baseFilters.unitId),
        },
      });
    }

    // Group and sum
    pipeline.push({
      $group: {
        _id: null,
        total: { $sum: '$amount' },
      },
    });

    return pipeline;
  }

  private buildTransactionMonthlyPipeline(baseFilters: any, period: PeriodDates): any[] {
    const pipeline: any[] = [];

    // Match by date and status
    pipeline.push({
      $match: {
        dueDate: { $gte: period.startDate, $lte: period.endDate },
        status: PaymentStatus.PAID,
      },
    });

    // Lookup lease to get unit and property information
    pipeline.push({
      $lookup: {
        from: 'leases',
        localField: 'lease',
        foreignField: '_id',
        as: 'leaseData',
      },
    });

    // Lookup unit from lease
    pipeline.push({
      $lookup: {
        from: 'units',
        localField: 'leaseData.unit',
        foreignField: '_id',
        as: 'unitFromLease',
      },
    });

    // Add computed fields for property and unit
    pipeline.push({
      $addFields: {
        computedProperty: {
          $cond: {
            if: { $ne: ['$property', null] },
            then: '$property',
            else: { $arrayElemAt: ['$unitFromLease.property', 0] },
          },
        },
        computedUnit: {
          $cond: {
            if: { $ne: ['$unit', null] },
            then: '$unit',
            else: { $arrayElemAt: ['$leaseData.unit', 0] },
          },
        },
      },
    });

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          computedProperty: { $in: baseFilters.properties },
        },
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      pipeline.push({
        $match: {
          computedProperty: new Types.ObjectId(baseFilters.propertyId),
        },
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      pipeline.push({
        $match: {
          computedUnit: new Types.ObjectId(baseFilters.unitId),
        },
      });
    }

    // Group by month
    pipeline.push({
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$dueDate' },
        },
        revenue: { $sum: '$amount' },
      },
    });

    pipeline.push({ $sort: { _id: 1 } });

    return pipeline;
  }

  private buildExpenseMonthlyPipeline(baseFilters: any, period: PeriodDates): any[] {
    const pipeline: any[] = [];

    // Match by date and status
    pipeline.push({
      $match: {
        date: { $gte: period.startDate, $lte: period.endDate },
        status: ExpenseStatus.CONFIRMED,
      },
    });

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          property: { $in: baseFilters.properties },
        },
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      pipeline.push({
        $match: {
          property: new Types.ObjectId(baseFilters.propertyId),
        },
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      pipeline.push({
        $match: {
          unit: new Types.ObjectId(baseFilters.unitId),
        },
      });
    }

    // Group by month
    pipeline.push({
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m', date: '$date' },
        },
        expense: { $sum: '$amount' },
      },
    });

    pipeline.push({ $sort: { _id: 1 } });

    return pipeline;
  }

  private async calculateInvoiceExpenses(
    baseFilters: any,
    period: PeriodDates,
    query: FinancialKPIQueryDto | { status?: TransactionStatus[] },
  ): Promise<number> {
    // Determine if we should include confirmed invoices
    // TransactionStatus.CONFIRMED or PAID maps to InvoiceStatus.CONFIRMED
    let includeConfirmed = true;
    if (query.status && query.status.length > 0) {
      includeConfirmed =
        query.status.includes(TransactionStatus.CONFIRMED) ||
        query.status.includes(TransactionStatus.PAID);
    }

    if (!includeConfirmed) {
      return 0;
    }

    // Get all invoices in the period with CONFIRMED status
    const invoiceMatch: any = {
      status: InvoiceStatus.CONFIRMED,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    };

    // Get invoices and populate their linked entities
    const invoices = await this.invoiceModel
      .find(invoiceMatch)
      .populate({
        path: 'linkedEntityId',
        select: 'property unit',
      })
      .lean();

    // Filter invoices based on property/unit scope
    let filteredInvoices = invoices;

    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      // Portfolio scope - filter by properties in array
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.property) return false;
        return baseFilters.properties.some(
          (propId: Types.ObjectId) => propId.toString() === linkedEntity.property.toString(),
        );
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      // Property scope - filter by specific property
      const propertyId = baseFilters.propertyId.toString();
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.property) return false;
        return linkedEntity.property.toString() === propertyId;
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      // Unit scope - filter by specific unit
      const unitId = baseFilters.unitId.toString();
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.unit) return false;
        return linkedEntity.unit.toString() === unitId;
      });
    }

    // Sum up invoice amounts
    const totalInvoiceExpenses = filteredInvoices.reduce(
      (sum, invoice) => sum + (invoice.amount || 0),
      0,
    );
    return totalInvoiceExpenses;
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }

  private mapRevenueTypeToPaymentType(revenueType: RevenueType): PaymentType {
    switch (revenueType) {
      case RevenueType.RENT:
        return PaymentType.RENT;
      case RevenueType.DEPOSIT:
        return PaymentType.DEPOSIT;
      case RevenueType.FEES:
        return PaymentType.FEES;
      case RevenueType.UTILITIES:
        return PaymentType.UTILITIES;
      case RevenueType.OTHER:
        return PaymentType.OTHER;
      default:
        return PaymentType.RENT;
    }
  }

  private async getRevenueBreakdown(
    baseFilters: any,
    period: PeriodDates,
    revenueType?: RevenueType,
  ): Promise<RevenueBreakdownDto[]> {
    const pipeline: any[] = [];

    // Match by date and status
    const match: any = {
      dueDate: { $gte: period.startDate, $lte: period.endDate },
      status: PaymentStatus.PAID,
    };

    if (revenueType) {
      match.type = this.mapRevenueTypeToPaymentType(revenueType);
    }

    pipeline.push({ $match: match });

    // Lookup lease to get unit and property information
    pipeline.push({
      $lookup: {
        from: 'leases',
        localField: 'lease',
        foreignField: '_id',
        as: 'leaseData',
      },
    });

    // Lookup unit from lease
    pipeline.push({
      $lookup: {
        from: 'units',
        localField: 'leaseData.unit',
        foreignField: '_id',
        as: 'unitFromLease',
      },
    });

    // Add computed fields for property and unit
    pipeline.push({
      $addFields: {
        computedProperty: {
          $cond: {
            if: { $ne: ['$property', null] },
            then: '$property',
            else: { $arrayElemAt: ['$unitFromLease.property', 0] },
          },
        },
        computedUnit: {
          $cond: {
            if: { $ne: ['$unit', null] },
            then: '$unit',
            else: { $arrayElemAt: ['$leaseData.unit', 0] },
          },
        },
      },
    });

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          computedProperty: { $in: baseFilters.properties },
        },
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      pipeline.push({
        $match: {
          computedProperty: new Types.ObjectId(baseFilters.propertyId),
        },
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      pipeline.push({
        $match: {
          computedUnit: new Types.ObjectId(baseFilters.unitId),
        },
      });
    }

    // Group by type
    pipeline.push({
      $group: { _id: '$type', amount: { $sum: '$amount' } },
    });

    const result = await this.transactionModel.aggregate(pipeline);

    const total = result.reduce((sum, item) => sum + item.amount, 0);

    return result.map((item) => ({
      type: item._id,
      amount: item.amount,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
  }

  private async getExpenseBreakdown(
    baseFilters: any,
    period: PeriodDates,
    expenseCategory?: string,
  ): Promise<ExpenseBreakdownDto[]> {
    const pipeline: any[] = [];

    // Match by date and status
    const match: any = {
      date: { $gte: period.startDate, $lte: period.endDate },
      status: ExpenseStatus.CONFIRMED,
    };

    if (expenseCategory) {
      match.category = expenseCategory;
    }

    pipeline.push({ $match: match });

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          property: { $in: baseFilters.properties },
        },
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      pipeline.push({
        $match: {
          property: new Types.ObjectId(baseFilters.propertyId),
        },
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      pipeline.push({
        $match: {
          unit: new Types.ObjectId(baseFilters.unitId),
        },
      });
    }

    // Group by category
    pipeline.push({
      $group: { _id: '$category', amount: { $sum: '$amount' } },
    });

    const result = await this.expenseModel.aggregate(pipeline);

    // Get invoice expenses and add as a category
    const invoiceExpenses = await this.calculateInvoiceExpenses(baseFilters, period, {
      status: [TransactionStatus.CONFIRMED],
    });

    // Add invoices as a separate category
    const breakdown = [...result];
    if (invoiceExpenses > 0) {
      breakdown.push({
        _id: 'Maintenance & Repairs',
        amount: invoiceExpenses,
      });
    }

    const total = breakdown.reduce((sum, item) => sum + item.amount, 0);
    return breakdown.map((item) => ({
      category: item._id,
      amount: item.amount,
      percentage: total > 0 ? (item.amount / total) * 100 : 0,
    }));
  }

  private async getMonthlyTrend(baseFilters: any, period: PeriodDates): Promise<MonthlyDataDto[]> {
    // Build revenue pipeline with monthly grouping
    const revenuePipeline = this.buildTransactionMonthlyPipeline(baseFilters, period);

    // Build expense pipeline with monthly grouping
    const expensePipeline = this.buildExpenseMonthlyPipeline(baseFilters, period);

    // Get monthly revenue and expenses
    const [revenueByMonth, expensesByMonth] = await Promise.all([
      this.transactionModel.aggregate(revenuePipeline),
      this.expenseModel.aggregate(expensePipeline),
    ]);

    // Get monthly invoice expenses
    const invoiceMatch: any = {
      status: InvoiceStatus.CONFIRMED,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    };

    const invoices = await this.invoiceModel
      .find(invoiceMatch)
      .populate({
        path: 'linkedEntityId',
        select: 'property unit',
      })
      .lean();

    // Filter invoices by property/unit scope
    let filteredInvoices = invoices;
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.property) return false;
        return baseFilters.properties.some(
          (propId: Types.ObjectId) => propId.toString() === linkedEntity.property.toString(),
        );
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      const propertyId = baseFilters.propertyId.toString();
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.property) return false;
        return linkedEntity.property.toString() === propertyId;
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      const unitId = baseFilters.unitId.toString();
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.unit) return false;
        return linkedEntity.unit.toString() === unitId;
      });
    }

    // Group invoices by month
    const invoicesByMonth = new Map<string, number>();
    filteredInvoices.forEach((invoice) => {
      const createdAt = (invoice as any).createdAt;
      if (createdAt) {
        const month = createdAt.toISOString().substring(0, 7); // YYYY-MM format
        const current = invoicesByMonth.get(month) || 0;
        invoicesByMonth.set(month, current + (invoice.amount || 0));
      }
    });

    // Merge revenue and expenses by month
    const monthlyMap = new Map<string, { revenue: number; expense: number }>();

    revenueByMonth.forEach((item) => {
      monthlyMap.set(item._id, { revenue: item.revenue, expense: 0 });
    });

    expensesByMonth.forEach((item) => {
      const existing = monthlyMap.get(item._id) || { revenue: 0, expense: 0 };
      existing.expense = item.expense;
      monthlyMap.set(item._id, existing);
    });

    // Add invoice expenses to monthly totals
    invoicesByMonth.forEach((amount, month) => {
      const existing = monthlyMap.get(month) || { revenue: 0, expense: 0 };
      existing.expense += amount;
      monthlyMap.set(month, existing);
    });

    // Generate all months in the period range to ensure complete data
    const allMonths = this.generateMonthsInRange(period.startDate, period.endDate);

    // Ensure all months have entries (with 0 if no data)
    allMonths.forEach((month) => {
      if (!monthlyMap.has(month)) {
        monthlyMap.set(month, { revenue: 0, expense: 0 });
      }
    });

    // Sort by month and return
    return Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, data]) => ({
        month,
        revenue: data.revenue,
        expense: data.expense,
        noi: data.revenue - data.expense,
      }));
  }

  private generateMonthsInRange(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const current = new Date(startDate);
    current.setDate(1); // Set to first day of month

    const end = new Date(endDate);
    end.setDate(1); // Set to first day of month

    while (current <= end) {
      const monthStr = current.toISOString().substring(0, 7); // YYYY-MM format
      months.push(monthStr);
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  private async getRevenueShare(
    scope: AggregationScope,
    period: PeriodDates,
    baseFilters: any,
  ): Promise<RevenueShareDto[]> {
    if (scope === AggregationScope.UNIT) {
      // Don't show revenue share for unit scope
      return [];
    }

    const pipeline: any[] = [];

    // Match by date and status
    pipeline.push({
      $match: {
        dueDate: { $gte: period.startDate, $lte: period.endDate },
        status: PaymentStatus.PAID,
      },
    });

    // Lookup lease to get unit and property information
    pipeline.push({
      $lookup: {
        from: 'leases',
        localField: 'lease',
        foreignField: '_id',
        as: 'leaseData',
      },
    });

    // Lookup unit from lease
    pipeline.push({
      $lookup: {
        from: 'units',
        localField: 'leaseData.unit',
        foreignField: '_id',
        as: 'unitFromLease',
      },
    });

    // Add computed property field
    pipeline.push({
      $addFields: {
        computedProperty: {
          $cond: {
            if: { $ne: ['$property', null] },
            then: '$property',
            else: { $arrayElemAt: ['$unitFromLease.property', 0] },
          },
        },
      },
    });

    // Filter by portfolio if needed
    if (scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          computedProperty: { $in: baseFilters.properties },
        },
      });
    }

    // Group by property
    pipeline.push({
      $group: {
        _id: '$computedProperty',
        revenue: { $sum: '$amount' },
      },
    });

    // Lookup property details
    pipeline.push({
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: '_id',
        as: 'propertyDetails',
      },
    });

    pipeline.push({ $unwind: '$propertyDetails' });

    const result = await this.transactionModel.aggregate(pipeline);

    const total = result.reduce((sum, item) => sum + item.revenue, 0);

    return result.map((item) => ({
      entityId: item._id.toString(),
      entityName: item.propertyDetails.name || 'Unknown',
      entityType: 'property' as const,
      revenue: item.revenue,
      percentage: total > 0 ? (item.revenue / total) * 100 : 0,
    }));
  }

  private async getExpenseShare(
    scope: AggregationScope,
    period: PeriodDates,
    baseFilters: any,
  ): Promise<ExpenseShareDto[]> {
    if (scope === AggregationScope.UNIT) {
      return [];
    }

    const pipeline: any[] = [];

    // Match by date and status
    pipeline.push({
      $match: {
        date: { $gte: period.startDate, $lte: period.endDate },
        status: ExpenseStatus.CONFIRMED,
      },
    });

    // Filter by portfolio if needed
    if (scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      pipeline.push({
        $match: {
          property: { $in: baseFilters.properties },
        },
      });
    }

    // Group by property
    pipeline.push({
      $group: {
        _id: '$property',
        expense: { $sum: '$amount' },
      },
    });

    // Lookup property details
    pipeline.push({
      $lookup: {
        from: 'properties',
        localField: '_id',
        foreignField: '_id',
        as: 'propertyDetails',
      },
    });

    pipeline.push({ $unwind: '$propertyDetails' });

    const result = await this.expenseModel.aggregate(pipeline);

    // Get invoice expenses grouped by property
    const invoiceMatch: any = {
      status: InvoiceStatus.CONFIRMED,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    };

    const invoices = await this.invoiceModel
      .find(invoiceMatch)
      .populate({
        path: 'linkedEntityId',
        select: 'property',
      })
      .lean();

    // Filter and group invoices by property
    const invoicesByProperty = new Map<string, number>();
    invoices.forEach((invoice) => {
      const linkedEntity = invoice.linkedEntityId as any;
      if (linkedEntity && linkedEntity.property) {
        const propertyId = linkedEntity.property.toString();

        // Filter by portfolio if needed
        if (scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
          const isInPortfolio = baseFilters.properties.some(
            (propId: Types.ObjectId) => propId.toString() === propertyId,
          );
          if (!isInPortfolio) return;
        }

        const current = invoicesByProperty.get(propertyId) || 0;
        invoicesByProperty.set(propertyId, current + (invoice.amount || 0));
      }
    });

    // Merge expenses and invoices by property
    const expenseMap = new Map<string, { expense: number; propertyDetails: any }>();

    result.forEach((item) => {
      const propertyId = item._id.toString();
      expenseMap.set(propertyId, {
        expense: item.expense,
        propertyDetails: item.propertyDetails,
      });
    });

    // Add invoice expenses to existing properties or create new entries
    for (const [propertyId, invoiceAmount] of invoicesByProperty.entries()) {
      if (expenseMap.has(propertyId)) {
        const existing = expenseMap.get(propertyId)!;
        existing.expense += invoiceAmount;
      } else {
        // Need to fetch property details for properties that only have invoices
        const property = await this.propertyModel.findById(propertyId);
        if (property) {
          expenseMap.set(propertyId, {
            expense: invoiceAmount,
            propertyDetails: property,
          });
        }
      }
    }

    const expenseData = Array.from(expenseMap.entries()).map(([propertyId, data]) => ({
      _id: propertyId,
      expense: data.expense,
      propertyDetails: data.propertyDetails,
    }));

    const total = expenseData.reduce((sum, item) => sum + item.expense, 0);

    return expenseData.map((item) => ({
      entityId: item._id.toString(),
      entityName: item.propertyDetails.name || 'Unknown',
      entityType: 'property' as const,
      expense: item.expense,
      percentage: total > 0 ? (item.expense / total) * 100 : 0,
    }));
  }

  private async getMaintenanceCost(baseFilters: any, period: PeriodDates): Promise<number> {
    // Maintenance cost comes from contractor invoices
    const invoiceMatch: any = {
      status: InvoiceStatus.CONFIRMED,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    };

    const invoices = await this.invoiceModel
      .find(invoiceMatch)
      .populate({
        path: 'linkedEntityId',
        select: 'property unit',
      })
      .lean();

    // Filter invoices based on property/unit scope
    let filteredInvoices = invoices;

    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.property) return false;
        return baseFilters.properties.some(
          (propId: Types.ObjectId) => propId.toString() === linkedEntity.property.toString(),
        );
      });
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      const propertyId = baseFilters.propertyId.toString();
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.property) return false;
        return linkedEntity.property.toString() === propertyId;
      });
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      const unitId = baseFilters.unitId.toString();
      filteredInvoices = invoices.filter((invoice) => {
        const linkedEntity = invoice.linkedEntityId as any;
        if (!linkedEntity || !linkedEntity.unit) return false;
        return linkedEntity.unit.toString() === unitId;
      });
    }

    // Sum up invoice amounts
    return filteredInvoices.reduce((sum, invoice) => sum + (invoice.amount || 0), 0);
  }
}
