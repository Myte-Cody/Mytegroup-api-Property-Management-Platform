import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { endOfMonth, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { Model, Types } from 'mongoose';
import { InvoiceStatus, TicketStatus } from '../../../common/enums/maintenance.enum';
import { Invoice } from '../../maintenance/schemas/invoice.schema';
import { MaintenanceTicket } from '../../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../../maintenance/schemas/scope-of-work.schema';
import { Property } from '../../properties/schemas/property.schema';
import { User } from '../../users/schemas/user.schema';
import { AggregationScope, PeriodType } from '../dto/financial-kpi.dto';
import {
  CategoryBreakdownDto,
  ContractorPerformanceDto,
  CreatorType,
  MaintenanceCostInvoicingKPIResponseDto,
  MaintenanceCostPeriodDto,
  MaintenanceKPIQueryDto,
  MaintenanceKPIResponseDto,
  MaintenancePeriodDataDto,
  MonthlyTicketTrendDto,
  PropertyMaintenanceShareDto,
  ResolutionCompletionKPIResponseDto,
  ResolutionCompletionPeriodDto,
  StatusBreakdownDto,
  TicketWorkVolumeKPIResponseDto,
  TicketWorkVolumePeriodDto,
  TicketsByCreatorDto,
} from '../dto/maintenance-kpi.dto';

interface PeriodDates {
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class MaintenanceKPIService {
  constructor(
    @InjectModel(MaintenanceTicket.name)
    private maintenanceTicketModel: Model<MaintenanceTicket>,
    @InjectModel(ScopeOfWork.name)
    private scopeOfWorkModel: Model<ScopeOfWork>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<Invoice>,
    @InjectModel(Property.name)
    private propertyModel: Model<Property>,
    @InjectModel(User.name)
    private userModel: Model<User>,
  ) {}

  async getMaintenanceKPIs(query: MaintenanceKPIQueryDto): Promise<MaintenanceKPIResponseDto> {
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
    const currentData = await this.calculatePeriodData(baseMatchFilters, currentPeriod);

    // Calculate previous period KPIs if comparison is enabled
    let previousData: MaintenancePeriodDataDto | undefined;
    if (previousPeriod) {
      previousData = await this.calculatePeriodData(baseMatchFilters, previousPeriod);

      // Calculate growth rate
      currentData.ticketGrowthRate = this.calculateGrowthRate(
        currentData.totalTickets,
        previousData.totalTickets,
      );
    }

    // Get detailed breakdowns and trends
    const [categoryBreakdown, statusBreakdown, contractorPerformance, monthlyTrend, propertyShare] =
      await Promise.all([
        this.getCategoryBreakdown(baseMatchFilters, currentPeriod),
        this.getStatusBreakdown(baseMatchFilters, currentPeriod),
        this.getContractorPerformance(baseMatchFilters, currentPeriod),
        this.getMonthlyTrend(baseMatchFilters, currentPeriod),
        this.getPropertyShare(query.scope, currentPeriod, baseMatchFilters),
      ]);

    return {
      current: currentData,
      previous: previousData,
      categoryBreakdown,
      statusBreakdown,
      contractorPerformance,
      monthlyTrend,
      propertyShare,
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

      default: {
        const prevMonth = subMonths(current.startDate, 1);
        return {
          startDate: startOfMonth(prevMonth),
          endDate: endOfMonth(prevMonth),
        };
      }
    }
  }

  private async buildMatchFilters(query: MaintenanceKPIQueryDto): Promise<any> {
    const filters: any = {
      scope: query.scope,
      propertyId: query.propertyId,
      unitId: query.unitId,
      tenantId: query.tenantId,
      creator: query.creator,
      categories: query.categories,
      statuses: query.statuses,
      contractorId: query.contractorId,
    };

    // For portfolio scope, get all properties
    if (query.scope === AggregationScope.PORTFOLIO) {
      const properties = await this.propertyModel.find().select('_id');
      filters.properties = properties.map((p) => p._id);
    }

    // Get user IDs for creator filter
    if (query.creator !== CreatorType.ALL) {
      const userType = query.creator === CreatorType.TENANT ? 'Tenant' : 'Landlord';
      const users = await this.userModel.find({ user_type: userType }).select('_id');
      filters.creatorUserIds = users.map((u) => u._id);
    }

    return filters;
  }

  private buildTicketPipeline(baseFilters: any, period: PeriodDates): any[] {
    const pipeline: any[] = [];

    // Match by date (tickets created in the period)
    const match: any = {
      requestDate: { $gte: period.startDate, $lte: period.endDate },
    };

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      match.property = { $in: baseFilters.properties };
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      match.property = new Types.ObjectId(baseFilters.propertyId) as any;
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      match.unit = new Types.ObjectId(baseFilters.unitId) as any;
    }

    // Apply tenant filter
    if (baseFilters.tenantId) {
      match.requestedBy = new Types.ObjectId(baseFilters.tenantId) as any;
    }

    // Apply creator type filter
    if (baseFilters.creatorUserIds) {
      match.requestedBy = { $in: baseFilters.creatorUserIds };
    }

    // Apply category filter
    if (baseFilters.categories && baseFilters.categories.length > 0) {
      match.category = { $in: baseFilters.categories };
    }

    // Apply status filter
    if (baseFilters.statuses && baseFilters.statuses.length > 0) {
      match.status = { $in: baseFilters.statuses };
    }

    // Apply contractor filter
    if (baseFilters.contractorId) {
      match.assignedContractor = new Types.ObjectId(baseFilters.contractorId) as any;
    }

    pipeline.push({ $match: match });

    return pipeline;
  }

  private async calculatePeriodData(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<MaintenancePeriodDataDto> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Add aggregation stages
    pipeline.push({
      $facet: {
        totals: [
          {
            $group: {
              _id: null,
              totalTickets: { $sum: 1 },
              openTickets: {
                $sum: { $cond: [{ $eq: ['$status', TicketStatus.OPEN] }, 1, 0] },
              },
              inProgressTickets: {
                $sum: {
                  $cond: [
                    {
                      $in: ['$status', [TicketStatus.IN_PROGRESS, TicketStatus.ASSIGNED]],
                    },
                    1,
                    0,
                  ],
                },
              },
              closedTickets: {
                $sum: { $cond: [{ $eq: ['$status', TicketStatus.CLOSED] }, 1, 0] },
              },
            },
          },
        ],
        resolutionTimes: [
          {
            $match: {
              completedDate: { $exists: true },
              requestDate: { $exists: true },
            },
          },
          {
            $project: {
              resolutionTime: {
                $divide: [
                  { $subtract: ['$completedDate', '$requestDate'] },
                  1000 * 60 * 60, // Convert to hours
                ],
              },
            },
          },
          {
            $group: {
              _id: null,
              avgResolutionTime: { $avg: '$resolutionTime' },
            },
          },
        ],
      },
    });

    const result = await this.maintenanceTicketModel.aggregate(pipeline);

    const totals = result[0]?.totals[0] || {
      totalTickets: 0,
      openTickets: 0,
      inProgressTickets: 0,
      closedTickets: 0,
    };

    const avgResolutionTime = result[0]?.resolutionTimes[0]?.avgResolutionTime || 0;

    return {
      totalTickets: totals.totalTickets,
      openTickets: totals.openTickets,
      inProgressTickets: totals.inProgressTickets,
      closedTickets: totals.closedTickets,
      avgResolutionTime: Math.round(avgResolutionTime * 100) / 100, // Round to 2 decimal places
    };
  }

  private async getCategoryBreakdown(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<CategoryBreakdownDto[]> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    pipeline.push({
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        totalResolutionTime: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$completedDate', null] }, { $ne: ['$requestDate', null] }] },
              {
                $divide: [{ $subtract: ['$completedDate', '$requestDate'] }, 1000 * 60 * 60],
              },
              0,
            ],
          },
        },
        completedCount: {
          $sum: {
            $cond: [{ $ne: ['$completedDate', null] }, 1, 0],
          },
        },
      },
    });

    pipeline.push({ $sort: { count: -1 } });

    const results = await this.maintenanceTicketModel.aggregate(pipeline);

    const total = results.reduce((sum, item) => sum + item.count, 0);

    return results.map((item) => ({
      category: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 10000) / 100 : 0,
      avgResolutionTime:
        item.completedCount > 0
          ? Math.round((item.totalResolutionTime / item.completedCount) * 100) / 100
          : undefined,
    }));
  }

  private async getStatusBreakdown(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<StatusBreakdownDto[]> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    pipeline.push({
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    });

    pipeline.push({ $sort: { count: -1 } });

    const results = await this.maintenanceTicketModel.aggregate(pipeline);

    const total = results.reduce((sum, item) => sum + item.count, 0);

    return results.map((item) => ({
      status: item._id,
      count: item.count,
      percentage: total > 0 ? Math.round((item.count / total) * 10000) / 100 : 0,
    }));
  }

  private async getContractorPerformance(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<ContractorPerformanceDto[]> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Only include tickets with assigned contractors
    pipeline.push({
      $match: {
        assignedContractor: { $exists: true, $ne: null },
      },
    });

    pipeline.push({
      $group: {
        _id: '$assignedContractor',
        ticketsAssigned: { $sum: 1 },
        ticketsCompleted: {
          $sum: {
            $cond: [{ $in: ['$status', [TicketStatus.DONE, TicketStatus.CLOSED]] }, 1, 0],
          },
        },
        totalResolutionTime: {
          $sum: {
            $cond: [
              { $and: [{ $ne: ['$completedDate', null] }, { $ne: ['$requestDate', null] }] },
              {
                $divide: [{ $subtract: ['$completedDate', '$requestDate'] }, 1000 * 60 * 60],
              },
              0,
            ],
          },
        },
      },
    });

    pipeline.push({
      $lookup: {
        from: 'contractors',
        localField: '_id',
        foreignField: '_id',
        as: 'contractorData',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$contractorData',
        preserveNullAndEmptyArrays: true,
      },
    });

    pipeline.push({ $sort: { ticketsAssigned: -1 } });

    const results = await this.maintenanceTicketModel.aggregate(pipeline);

    return results.map((item) => ({
      contractorId: item._id.toString(),
      contractorName: item.contractorData?.name || 'Unknown',
      ticketsAssigned: item.ticketsAssigned,
      ticketsCompleted: item.ticketsCompleted,
      avgResolutionTime:
        item.ticketsCompleted > 0
          ? Math.round((item.totalResolutionTime / item.ticketsCompleted) * 100) / 100
          : 0,
      completionRate:
        item.ticketsAssigned > 0
          ? Math.round((item.ticketsCompleted / item.ticketsAssigned) * 10000) / 100
          : 0,
    }));
  }

  private async getMonthlyTrend(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<MonthlyTicketTrendDto[]> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    pipeline.push({
      $project: {
        month: {
          $dateToString: { format: '%Y-%m', date: '$requestDate' },
        },
        status: 1,
      },
    });

    pipeline.push({
      $group: {
        _id: '$month',
        opened: { $sum: 1 },
        closed: {
          $sum: { $cond: [{ $eq: ['$status', TicketStatus.CLOSED] }, 1, 0] },
        },
        inProgress: {
          $sum: {
            $cond: [
              {
                $in: [
                  '$status',
                  [TicketStatus.IN_PROGRESS, TicketStatus.ASSIGNED, TicketStatus.IN_REVIEW],
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    });

    pipeline.push({ $sort: { _id: 1 } });

    const results = await this.maintenanceTicketModel.aggregate(pipeline);

    return results.map((item) => ({
      month: item._id,
      opened: item.opened,
      closed: item.closed,
      inProgress: item.inProgress,
    }));
  }

  private async getPropertyShare(
    scope: AggregationScope,
    period: PeriodDates,
    baseFilters: any,
  ): Promise<PropertyMaintenanceShareDto[]> {
    if (scope === AggregationScope.UNIT) {
      return [];
    }

    const pipeline = this.buildTicketPipeline(baseFilters, period);

    if (scope === AggregationScope.PORTFOLIO) {
      // Group by property
      pipeline.push({
        $group: {
          _id: '$property',
          ticketCount: { $sum: 1 },
        },
      });

      pipeline.push({
        $lookup: {
          from: 'properties',
          localField: '_id',
          foreignField: '_id',
          as: 'propertyData',
        },
      });

      pipeline.push({
        $unwind: {
          path: '$propertyData',
          preserveNullAndEmptyArrays: true,
        },
      });
    } else if (scope === AggregationScope.PROPERTY) {
      // Group by unit
      pipeline.push({
        $match: {
          unit: { $exists: true, $ne: null },
        },
      });

      pipeline.push({
        $group: {
          _id: '$unit',
          ticketCount: { $sum: 1 },
        },
      });

      pipeline.push({
        $lookup: {
          from: 'units',
          localField: '_id',
          foreignField: '_id',
          as: 'unitData',
        },
      });

      pipeline.push({
        $unwind: {
          path: '$unitData',
          preserveNullAndEmptyArrays: true,
        },
      });
    }

    pipeline.push({ $sort: { ticketCount: -1 } });

    const results = await this.maintenanceTicketModel.aggregate(pipeline);

    const total = results.reduce((sum, item) => sum + item.ticketCount, 0);

    return results.map((item) => {
      if (scope === AggregationScope.PORTFOLIO) {
        return {
          entityId: item._id.toString(),
          entityName: item.propertyData?.name || 'Unknown Property',
          entityType: 'property' as const,
          ticketCount: item.ticketCount,
          percentage: total > 0 ? Math.round((item.ticketCount / total) * 10000) / 100 : 0,
        };
      } else {
        return {
          entityId: item._id.toString(),
          entityName: item.unitData?.name || 'Unknown Unit',
          entityType: 'unit' as const,
          ticketCount: item.ticketCount,
          percentage: total > 0 ? Math.round((item.ticketCount / total) * 10000) / 100 : 0,
        };
      }
    });
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Math.round(((current - previous) / previous) * 10000) / 100;
  }

  // Ticket & Work Volume KPIs
  async getTicketWorkVolumeKPIs(
    query: MaintenanceKPIQueryDto,
  ): Promise<TicketWorkVolumeKPIResponseDto> {
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

    // Calculate current period data
    const current = await this.calculateTicketWorkVolumeData(baseMatchFilters, currentPeriod);

    // Calculate previous period data if comparison is enabled
    let previous: TicketWorkVolumePeriodDto | undefined;
    if (previousPeriod) {
      previous = await this.calculateTicketWorkVolumeData(baseMatchFilters, previousPeriod);
    }

    return {
      current,
      previous,
    };
  }

  private async calculateTicketWorkVolumeData(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<TicketWorkVolumePeriodDto> {
    // Run all calculations in parallel for performance
    const [
      totalTickets,
      ticketsByCreator,
      standaloneTickets,
      propertyWideTickets,
      totalSOWs,
      closedSOWs,
      totalSubSOWs,
      closedSubSOWs,
    ] = await Promise.all([
      this.getTotalTickets(baseFilters, period),
      this.getTicketsByCreator(baseFilters, period),
      this.getStandaloneTickets(baseFilters, period),
      this.getPropertyWideTickets(baseFilters, period),
      this.getTotalSOWs(baseFilters, period),
      this.getClosedSOWs(baseFilters, period),
      this.getTotalSubSOWs(baseFilters, period),
      this.getClosedSubSOWs(baseFilters, period),
    ]);

    const standaloneTicketsPercentage =
      totalTickets > 0 ? (standaloneTickets / totalTickets) * 100 : 0;
    const propertyWideTicketsPercentage =
      totalTickets > 0 ? (propertyWideTickets / totalTickets) * 100 : 0;
    const subSOWsPerSOW = totalSOWs > 0 ? totalSubSOWs / totalSOWs : 0;

    return {
      totalTickets,
      ticketsByCreator,
      standaloneTicketsPercentage: Math.round(standaloneTicketsPercentage * 100) / 100,
      standaloneTicketsCount: standaloneTickets,
      propertyWideTicketsPercentage: Math.round(propertyWideTicketsPercentage * 100) / 100,
      propertyWideTicketsCount: propertyWideTickets,
      totalSOWs,
      closedSOWs,
      totalSubSOWs,
      closedSubSOWs,
      subSOWsPerSOW: Math.round(subSOWsPerSOW * 100) / 100,
    };
  }

  private async getTotalTickets(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);
    pipeline.push({ $count: 'total' });

    const result = await this.maintenanceTicketModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getTicketsByCreator(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<TicketsByCreatorDto> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Lookup user data to get user_type
    pipeline.push({
      $lookup: {
        from: 'users',
        localField: 'requestedBy',
        foreignField: '_id',
        as: 'creatorData',
      },
    });

    pipeline.push({
      $unwind: {
        path: '$creatorData',
        preserveNullAndEmptyArrays: true,
      },
    });

    // Group by user_type
    pipeline.push({
      $group: {
        _id: '$creatorData.user_type',
        count: { $sum: 1 },
      },
    });

    const results = await this.maintenanceTicketModel.aggregate(pipeline);

    let tenantCount = 0;
    let landlordCount = 0;
    let totalCount = 0;

    results.forEach((item) => {
      if (item._id === 'Tenant') {
        tenantCount = item.count;
      } else if (item._id === 'Landlord') {
        landlordCount = item.count;
      }
      totalCount += item.count;
    });

    const tenantPercentage = totalCount > 0 ? (tenantCount / totalCount) * 100 : 0;
    const landlordPercentage = totalCount > 0 ? (landlordCount / totalCount) * 100 : 0;

    return {
      tenantPercentage: Math.round(tenantPercentage * 100) / 100,
      landlordPercentage: Math.round(landlordPercentage * 100) / 100,
      tenantCount,
      landlordCount,
      graphicalData: [
        { label: 'Tenant Created', value: tenantCount },
        { label: 'Landlord Created', value: landlordCount },
      ],
    };
  }

  private async getStandaloneTickets(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Match tickets without SOW
    pipeline.push({
      $match: {
        $or: [{ scopeOfWork: { $exists: false } }, { scopeOfWork: null }],
      },
    });

    pipeline.push({ $count: 'total' });

    const result = await this.maintenanceTicketModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getPropertyWideTickets(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Match tickets without unit
    pipeline.push({
      $match: {
        $or: [{ unit: { $exists: false } }, { unit: null }],
      },
    });

    pipeline.push({ $count: 'total' });

    const result = await this.maintenanceTicketModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getTotalSOWs(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildSOWPipeline(baseFilters, period, false);
    pipeline.push({ $count: 'total' });

    const result = await this.scopeOfWorkModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getClosedSOWs(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildSOWPipeline(baseFilters, period, false);

    // Match closed SOWs within period
    pipeline.push({
      $match: {
        status: TicketStatus.CLOSED,
        completedDate: { $gte: period.startDate, $lte: period.endDate },
      },
    });

    pipeline.push({ $count: 'total' });

    const result = await this.scopeOfWorkModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getTotalSubSOWs(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildSOWPipeline(baseFilters, period, true);
    pipeline.push({ $count: 'total' });

    const result = await this.scopeOfWorkModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getClosedSubSOWs(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildSOWPipeline(baseFilters, period, true);

    // Match closed Sub-SOWs within period
    pipeline.push({
      $match: {
        status: TicketStatus.CLOSED,
        completedDate: { $gte: period.startDate, $lte: period.endDate },
      },
    });

    pipeline.push({ $count: 'total' });

    const result = await this.scopeOfWorkModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private buildSOWPipeline(baseFilters: any, period: PeriodDates, isSubSOW: boolean): any[] {
    const pipeline: any[] = [];

    // Match by creation date
    const match: any = {
      createdAt: { $gte: period.startDate, $lte: period.endDate },
      deleted: { $ne: true },
    };

    // Filter by parent SOW
    if (isSubSOW) {
      // Sub-SOWs have a parentSow
      match.parentSow = { $exists: true, $ne: null };
    } else {
      // Main SOWs don't have a parentSow
      match.$or = [{ parentSow: { $exists: false } }, { parentSow: null }];
    }

    // Apply scope-based filtering
    if (baseFilters.scope === AggregationScope.PORTFOLIO && baseFilters.properties) {
      match.property = { $in: baseFilters.properties };
    } else if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
      match.property = new Types.ObjectId(baseFilters.propertyId) as any;
    } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
      match.unit = new Types.ObjectId(baseFilters.unitId) as any;
    }

    // Apply contractor filter
    if (baseFilters.contractorId) {
      match.assignedContractor = new Types.ObjectId(baseFilters.contractorId) as any;
    }

    pipeline.push({ $match: match });

    return pipeline;
  }

  // Maintenance Cost & Invoicing KPIs
  async getMaintenanceCostInvoicingKPIs(
    query: MaintenanceKPIQueryDto,
  ): Promise<MaintenanceCostInvoicingKPIResponseDto> {
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

    // Calculate current period data
    const current = await this.calculateMaintenanceCostData(baseMatchFilters, currentPeriod);

    // Calculate previous period data if comparison is enabled
    let previous: MaintenanceCostPeriodDto | undefined;
    if (previousPeriod) {
      previous = await this.calculateMaintenanceCostData(baseMatchFilters, previousPeriod);
    }

    return {
      current,
      previous,
    };
  }

  private async calculateMaintenanceCostData(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<MaintenanceCostPeriodDto> {
    // Run all calculations in parallel for performance
    const [
      totalMaintenanceCost,
      closedJobsCount,
      invoicesPendingConfirmation,
      confirmedInvoices,
      propertyWideCostAmount,
    ] = await Promise.all([
      this.getTotalMaintenanceCost(baseFilters, period),
      this.getClosedJobsCount(baseFilters, period),
      this.getInvoicesPendingConfirmation(baseFilters, period),
      this.getConfirmedInvoices(baseFilters, period),
      this.getPropertyWideCost(baseFilters, period),
    ]);

    const averageCostPerJob = closedJobsCount > 0 ? totalMaintenanceCost / closedJobsCount : 0;
    const propertyWideCostSharePercentage =
      totalMaintenanceCost > 0 ? (propertyWideCostAmount / totalMaintenanceCost) * 100 : 0;

    return {
      totalMaintenanceCost: Math.round(totalMaintenanceCost * 100) / 100,
      averageCostPerJob: Math.round(averageCostPerJob * 100) / 100,
      invoicesPendingConfirmation,
      confirmedInvoices,
      propertyWideCostSharePercentage: Math.round(propertyWideCostSharePercentage * 100) / 100,
      propertyWideCostAmount: Math.round(propertyWideCostAmount * 100) / 100,
      closedJobsCount,
    };
  }

  private async getTotalMaintenanceCost(baseFilters: any, period: PeriodDates): Promise<number> {
    // Get all closed tickets, SOWs, and Sub-SOWs
    const closedTicketIds = await this.getClosedEntityIds('ticket', baseFilters, period);
    const closedSOWIds = await this.getClosedEntityIds('sow', baseFilters, period);
    const closedSubSOWIds = await this.getClosedEntityIds('sub-sow', baseFilters, period);

    // Get all invoices for these closed entities
    const pipeline: any[] = [];

    const match: any = {
      deleted: { $ne: true },
      status: InvoiceStatus.CONFIRMED,
      $or: [
        {
          linkedEntityModel: 'MaintenanceTicket',
          linkedEntityId: { $in: closedTicketIds },
        },
        {
          linkedEntityModel: 'ScopeOfWork',
          linkedEntityId: { $in: [...closedSOWIds, ...closedSubSOWIds] },
        },
      ],
    };

    pipeline.push({ $match: match });

    pipeline.push({
      $group: {
        _id: null,
        totalCost: { $sum: '$amount' },
      },
    });

    const result = await this.invoiceModel.aggregate(pipeline);
    return result.length > 0 ? result[0].totalCost : 0;
  }

  private async getClosedJobsCount(baseFilters: any, period: PeriodDates): Promise<number> {
    const [closedTickets, closedSOWs, closedSubSOWs] = await Promise.all([
      this.getClosedEntityIds('ticket', baseFilters, period),
      this.getClosedEntityIds('sow', baseFilters, period),
      this.getClosedEntityIds('sub-sow', baseFilters, period),
    ]);

    return closedTickets.length + closedSOWs.length + closedSubSOWs.length;
  }

  private async getClosedEntityIds(
    entityType: 'ticket' | 'sow' | 'sub-sow',
    baseFilters: any,
    period: PeriodDates,
  ): Promise<Types.ObjectId[]> {
    if (entityType === 'ticket') {
      const pipeline = this.buildTicketPipeline(baseFilters, period);
      pipeline.push({
        $match: {
          status: TicketStatus.CLOSED,
          completedDate: { $gte: period.startDate, $lte: period.endDate },
        },
      });
      pipeline.push({ $project: { _id: 1 } });

      const result = await this.maintenanceTicketModel.aggregate(pipeline);
      return result.map((item) => item._id);
    } else {
      const isSubSOW = entityType === 'sub-sow';
      const pipeline = this.buildSOWPipeline(baseFilters, period, isSubSOW);
      pipeline.push({
        $match: {
          status: TicketStatus.CLOSED,
          completedDate: { $gte: period.startDate, $lte: period.endDate },
        },
      });
      pipeline.push({ $project: { _id: 1 } });

      const result = await this.scopeOfWorkModel.aggregate(pipeline);
      return result.map((item) => item._id);
    }
  }

  private async getInvoicesPendingConfirmation(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<number> {
    const match: any = {
      deleted: { $ne: true },
      status: InvoiceStatus.DRAFT,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    };

    // Apply scope filtering if needed
    if (baseFilters.scope !== AggregationScope.PORTFOLIO) {
      // Need to lookup the linked entity to filter by property/unit
      const pipeline: any[] = [];
      pipeline.push({ $match: match });

      // Lookup tickets
      pipeline.push({
        $lookup: {
          from: 'maintenancetickets',
          localField: 'linkedEntityId',
          foreignField: '_id',
          as: 'ticketData',
        },
      });

      // Lookup SOWs
      pipeline.push({
        $lookup: {
          from: 'scopeofworks',
          localField: 'linkedEntityId',
          foreignField: '_id',
          as: 'sowData',
        },
      });

      // Add property/unit filters
      const scopeMatch: any = {
        $or: [],
      };

      if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
        scopeMatch.$or.push(
          { 'ticketData.property': new Types.ObjectId(baseFilters.propertyId) },
          { 'sowData.property': new Types.ObjectId(baseFilters.propertyId) },
        );
      } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
        scopeMatch.$or.push(
          { 'ticketData.unit': new Types.ObjectId(baseFilters.unitId) },
          { 'sowData.unit': new Types.ObjectId(baseFilters.unitId) },
        );
      }

      if (scopeMatch.$or.length > 0) {
        pipeline.push({ $match: scopeMatch });
      }

      pipeline.push({ $count: 'total' });

      const result = await this.invoiceModel.aggregate(pipeline);
      return result.length > 0 ? result[0].total : 0;
    }

    return this.invoiceModel.countDocuments(match);
  }

  private async getConfirmedInvoices(baseFilters: any, period: PeriodDates): Promise<number> {
    const match: any = {
      deleted: { $ne: true },
      status: InvoiceStatus.CONFIRMED,
      createdAt: { $gte: period.startDate, $lte: period.endDate },
    };

    // Apply scope filtering if needed
    if (baseFilters.scope !== AggregationScope.PORTFOLIO) {
      const pipeline: any[] = [];
      pipeline.push({ $match: match });

      // Lookup tickets
      pipeline.push({
        $lookup: {
          from: 'maintenancetickets',
          localField: 'linkedEntityId',
          foreignField: '_id',
          as: 'ticketData',
        },
      });

      // Lookup SOWs
      pipeline.push({
        $lookup: {
          from: 'scopeofworks',
          localField: 'linkedEntityId',
          foreignField: '_id',
          as: 'sowData',
        },
      });

      // Add property/unit filters
      const scopeMatch: any = {
        $or: [],
      };

      if (baseFilters.scope === AggregationScope.PROPERTY && baseFilters.propertyId) {
        scopeMatch.$or.push(
          { 'ticketData.property': new Types.ObjectId(baseFilters.propertyId) },
          { 'sowData.property': new Types.ObjectId(baseFilters.propertyId) },
        );
      } else if (baseFilters.scope === AggregationScope.UNIT && baseFilters.unitId) {
        scopeMatch.$or.push(
          { 'ticketData.unit': new Types.ObjectId(baseFilters.unitId) },
          { 'sowData.unit': new Types.ObjectId(baseFilters.unitId) },
        );
      }

      if (scopeMatch.$or.length > 0) {
        pipeline.push({ $match: scopeMatch });
      }

      pipeline.push({ $count: 'total' });

      const result = await this.invoiceModel.aggregate(pipeline);
      return result.length > 0 ? result[0].total : 0;
    }

    return this.invoiceModel.countDocuments(match);
  }

  private async getPropertyWideCost(baseFilters: any, period: PeriodDates): Promise<number> {
    // Get closed property-wide tickets (no unit)
    const closedTickets = await this.getClosedEntityIds('ticket', baseFilters, period);
    const closedSOWs = await this.getClosedEntityIds('sow', baseFilters, period);
    const closedSubSOWs = await this.getClosedEntityIds('sub-sow', baseFilters, period);

    // Filter for property-wide entities (no unit)
    const pipeline: any[] = [];

    const match: any = {
      deleted: { $ne: true },
      status: InvoiceStatus.CONFIRMED,
    };

    pipeline.push({ $match: match });

    // Lookup the linked entity to check if it has a unit
    pipeline.push({
      $lookup: {
        from: 'maintenancetickets',
        localField: 'linkedEntityId',
        foreignField: '_id',
        as: 'ticketData',
      },
    });

    pipeline.push({
      $lookup: {
        from: 'scopeofworks',
        localField: 'linkedEntityId',
        foreignField: '_id',
        as: 'sowData',
      },
    });

    // Match only invoices where the linked entity has no unit and is closed
    pipeline.push({
      $match: {
        $or: [
          {
            linkedEntityModel: 'MaintenanceTicket',
            linkedEntityId: { $in: closedTickets },
            $or: [{ 'ticketData.unit': { $exists: false } }, { 'ticketData.unit': null }],
          },
          {
            linkedEntityModel: 'ScopeOfWork',
            linkedEntityId: { $in: [...closedSOWs, ...closedSubSOWs] },
            $or: [{ 'sowData.unit': { $exists: false } }, { 'sowData.unit': null }],
          },
        ],
      },
    });

    pipeline.push({
      $group: {
        _id: null,
        totalCost: { $sum: '$amount' },
      },
    });

    const result = await this.invoiceModel.aggregate(pipeline);
    return result.length > 0 ? result[0].totalCost : 0;
  }

  // Resolution & Completion KPIs
  async getResolutionCompletionKPIs(
    query: MaintenanceKPIQueryDto,
  ): Promise<ResolutionCompletionKPIResponseDto> {
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

    // Calculate current period data
    const current = await this.calculateResolutionCompletionData(baseMatchFilters, currentPeriod);

    // Calculate previous period data if comparison is enabled
    let previous: ResolutionCompletionPeriodDto | undefined;
    if (previousPeriod) {
      previous = await this.calculateResolutionCompletionData(baseMatchFilters, previousPeriod);
    }

    return {
      current,
      previous,
    };
  }

  private async calculateResolutionCompletionData(
    baseFilters: any,
    period: PeriodDates,
  ): Promise<ResolutionCompletionPeriodDto> {
    // Run all calculations in parallel for performance
    const [
      closedTickets,
      reopenedTicketsCount,
      totalTicketsCount,
      closedSOWsCount,
      totalSOWsCount,
      closedSubSOWsCount,
      totalSubSOWsCount,
    ] = await Promise.all([
      this.getClosedTicketsCount(baseFilters, period),
      this.getReopenedTicketsCount(baseFilters, period),
      this.getTotalTickets(baseFilters, period),
      this.getClosedSOWs(baseFilters, period),
      this.getTotalSOWs(baseFilters, period),
      this.getClosedSubSOWs(baseFilters, period),
      this.getTotalSubSOWs(baseFilters, period),
    ]);

    const reopenedTicketsPercentage =
      totalTicketsCount > 0 ? (reopenedTicketsCount / totalTicketsCount) * 100 : 0;
    const sowCompletionRate = totalSOWsCount > 0 ? (closedSOWsCount / totalSOWsCount) * 100 : 0;
    const subSOWCompletionRate =
      totalSubSOWsCount > 0 ? (closedSubSOWsCount / totalSubSOWsCount) * 100 : 0;

    return {
      closedTickets,
      reopenedTicketsPercentage: Math.round(reopenedTicketsPercentage * 100) / 100,
      reopenedTicketsCount,
      totalTicketsCount,
      sowCompletionRate: Math.round(sowCompletionRate * 100) / 100,
      closedSOWsCount,
      totalSOWsCount,
      subSOWCompletionRate: Math.round(subSOWCompletionRate * 100) / 100,
      closedSubSOWsCount,
      totalSubSOWsCount,
    };
  }

  private async getClosedTicketsCount(baseFilters: any, period: PeriodDates): Promise<number> {
    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Match tickets with DONE or CLOSED status and completed in the period
    pipeline.push({
      $match: {
        status: { $in: [TicketStatus.DONE, TicketStatus.CLOSED] },
        completedDate: { $gte: period.startDate, $lte: period.endDate },
      },
    });

    pipeline.push({ $count: 'total' });

    const result = await this.maintenanceTicketModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getReopenedTicketsCount(baseFilters: any, period: PeriodDates): Promise<number> {
    // Note: This is a simplified implementation
    // A more accurate implementation would require tracking status history
    // For now, we'll count tickets that are currently OPEN but have a completedDate
    // indicating they were previously closed and then reopened

    const pipeline = this.buildTicketPipeline(baseFilters, period);

    // Match tickets that have a completedDate (were closed before) but are now OPEN
    pipeline.push({
      $match: {
        completedDate: { $exists: true, $ne: null },
        status: {
          $in: [
            TicketStatus.OPEN,
            TicketStatus.IN_REVIEW,
            TicketStatus.ASSIGNED,
            TicketStatus.IN_PROGRESS,
          ],
        },
      },
    });

    pipeline.push({ $count: 'total' });

    const result = await this.maintenanceTicketModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }
}
