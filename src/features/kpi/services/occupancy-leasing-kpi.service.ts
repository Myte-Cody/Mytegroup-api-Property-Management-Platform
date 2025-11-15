import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { differenceInDays, endOfMonth, startOfMonth, startOfYear, subMonths } from 'date-fns';
import { Model, Types } from 'mongoose';
import { LeaseStatus } from '../../../common/enums/lease.enum';
import { Lease } from '../../leases/schemas/lease.schema';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import {
  LeaseRenewalRateDto,
  LeasingActivityDto,
  OccupancyLeasingKPIQueryDto,
  OccupancyLeasingKPIResponseDto,
  OccupancyLeasingPeriodDto,
  OccupancyPeriodType,
  OccupancyRateDto,
  OccupancyScope,
  OccupancyUtilizationDto,
  VacancyRateDto,
} from '../dto/occupancy-leasing-kpi.dto';

interface PeriodDates {
  startDate: Date;
  endDate: Date;
}

interface FilterContext {
  scope: OccupancyScope;
  propertyIds?: Types.ObjectId[];
  tenantId?: Types.ObjectId;
}

@Injectable()
export class OccupancyLeasingKPIService {
  constructor(
    @InjectModel(Lease.name) private leaseModel: Model<Lease>,
    @InjectModel(Unit.name) private unitModel: Model<Unit>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
  ) {}

  async getOccupancyLeasingKPIs(
    query: OccupancyLeasingKPIQueryDto,
  ): Promise<OccupancyLeasingKPIResponseDto> {
    // Get period dates
    const currentPeriod = this.getPeriodDates(
      query.period,
      query.customStartDate,
      query.customEndDate,
    );
    const previousPeriod = query.compare
      ? this.getPreviousPeriod(currentPeriod, query.period)
      : null;

    // Build filter context
    const filterContext = await this.buildFilterContext(query);

    // Calculate current period KPIs
    const current = await this.calculatePeriodData(filterContext, currentPeriod, query);

    // Calculate previous period KPIs if comparison is enabled
    let previous: OccupancyLeasingPeriodDto | undefined;
    if (previousPeriod) {
      previous = await this.calculatePeriodData(filterContext, previousPeriod, query);

      // Calculate occupancy growth rate
      const currentOccupancy = current.occupancyUtilization.occupancyRate.rate;
      const previousOccupancy = previous.occupancyUtilization.occupancyRate.rate;
      current.occupancyUtilization.occupancyGrowthRate = this.calculateGrowthRate(
        currentOccupancy,
        previousOccupancy,
      );
    }

    return {
      current,
      previous,
    };
  }

  private async calculatePeriodData(
    filterContext: FilterContext,
    period: PeriodDates,
    query: OccupancyLeasingKPIQueryDto,
  ): Promise<OccupancyLeasingPeriodDto> {
    // Calculate both sections in parallel for performance
    const [occupancyUtilization, leasingActivity] = await Promise.all([
      this.calculateOccupancyUtilization(filterContext, period),
      this.calculateLeasingActivity(filterContext, period),
    ]);

    return {
      occupancyUtilization,
      leasingActivity,
    };
  }

  private async calculateOccupancyUtilization(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<OccupancyUtilizationDto> {
    // Get total units in scope
    const totalUnits = await this.getTotalUnits(filterContext);

    // Get occupied units at the end of the period
    const occupiedUnits = await this.getOccupiedUnitsCount(filterContext, period);

    // Calculate occupancy rate
    const occupancyRate: OccupancyRateDto = {
      rate: totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0,
      occupiedUnits,
      totalUnits,
      graphicalData: [
        { label: 'Occupied', value: occupiedUnits },
        { label: 'Vacant', value: totalUnits - occupiedUnits },
      ],
    };

    // Calculate vacancy rate
    const vacantUnits = totalUnits - occupiedUnits;
    const vacancyRate: VacancyRateDto = {
      rate: totalUnits > 0 ? (vacantUnits / totalUnits) * 100 : 0,
      vacantUnits,
      totalUnits,
      graphicalData: [
        { label: 'Vacant', value: vacantUnits },
        { label: 'Occupied', value: occupiedUnits },
      ],
    };

    // Calculate average occupancy duration for active leases
    const averageOccupancyDuration = await this.getAverageOccupancyDuration(filterContext);

    return {
      occupancyRate,
      vacancyRate,
      averageOccupancyDuration,
    };
  }

  private async calculateLeasingActivity(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<LeasingActivityDto> {
    // Run all calculations in parallel
    const [
      newLeasesSigned,
      terminatedLeases,
      leaseRenewalRate,
      averageVacancyDuration,
      totalUnits,
    ] = await Promise.all([
      this.getNewLeasesSigned(filterContext, period),
      this.getTerminatedLeases(filterContext, period),
      this.getLeaseRenewalRate(filterContext, period),
      this.getAverageVacancyDuration(filterContext, period),
      this.getTotalUnits(filterContext),
    ]);

    // Calculate turnover rate
    const turnoverRate = totalUnits > 0 ? (terminatedLeases / totalUnits) * 100 : 0;

    return {
      newLeasesSigned,
      terminatedLeases,
      leaseRenewalRate,
      averageVacancyDuration,
      turnoverRate,
    };
  }

  private async getTotalUnits(filterContext: FilterContext): Promise<number> {
    const matchFilter: any = { deleted: { $ne: true } };

    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      matchFilter.property = { $in: filterContext.propertyIds };
    }

    return this.unitModel.countDocuments(matchFilter);
  }

  private async getOccupiedUnitsCount(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<number> {
    const pipeline: any[] = [];

    // Match active leases that overlap with the period
    const leaseMatch: any = {
      deleted: { $ne: true },
      status: LeaseStatus.ACTIVE,
      startDate: { $lte: period.endDate },
      endDate: { $gte: period.startDate },
    };

    if (filterContext.tenantId) {
      leaseMatch.tenant = filterContext.tenantId;
    }

    pipeline.push({ $match: leaseMatch });

    // Lookup unit data
    pipeline.push({
      $lookup: {
        from: 'units',
        localField: 'unit',
        foreignField: '_id',
        as: 'unitData',
      },
    });

    pipeline.push({ $unwind: '$unitData' });

    // Filter by property if needed
    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      pipeline.push({
        $match: {
          'unitData.property': { $in: filterContext.propertyIds },
          'unitData.deleted': { $ne: true },
        },
      });
    }

    // Group by unique units
    pipeline.push({
      $group: {
        _id: '$unit',
      },
    });

    pipeline.push({
      $count: 'total',
    });

    const result = await this.leaseModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getAverageOccupancyDuration(filterContext: FilterContext): Promise<number> {
    const pipeline: any[] = [];

    // Match active leases only
    const leaseMatch: any = {
      deleted: { $ne: true },
      status: LeaseStatus.ACTIVE,
    };

    if (filterContext.tenantId) {
      leaseMatch.tenant = filterContext.tenantId;
    }

    pipeline.push({ $match: leaseMatch });

    // Lookup unit data for property filtering
    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      pipeline.push({
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      });

      pipeline.push({ $unwind: '$unitData' });

      pipeline.push({
        $match: {
          'unitData.property': { $in: filterContext.propertyIds },
          'unitData.deleted': { $ne: true },
        },
      });
    }

    // Calculate duration in days
    pipeline.push({
      $project: {
        durationDays: {
          $divide: [{ $subtract: ['$endDate', '$startDate'] }, 1000 * 60 * 60 * 24],
        },
      },
    });

    // Calculate average
    pipeline.push({
      $group: {
        _id: null,
        averageDuration: { $avg: '$durationDays' },
      },
    });

    const result = await this.leaseModel.aggregate(pipeline);
    return result.length > 0 && result[0].averageDuration
      ? Math.round(result[0].averageDuration)
      : 0;
  }

  private async getNewLeasesSigned(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<number> {
    const pipeline: any[] = [];

    // Match leases that started in the period with ACTIVE status
    const leaseMatch: any = {
      deleted: { $ne: true },
      status: LeaseStatus.ACTIVE,
      startDate: { $gte: period.startDate, $lte: period.endDate },
    };

    if (filterContext.tenantId) {
      leaseMatch.tenant = filterContext.tenantId;
    }

    pipeline.push({ $match: leaseMatch });

    // Filter by property if needed
    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      pipeline.push({
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      });

      pipeline.push({ $unwind: '$unitData' });

      pipeline.push({
        $match: {
          'unitData.property': { $in: filterContext.propertyIds },
          'unitData.deleted': { $ne: true },
        },
      });
    }

    pipeline.push({ $count: 'total' });

    const result = await this.leaseModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getTerminatedLeases(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<number> {
    const pipeline: any[] = [];

    // Match leases terminated in the period
    const leaseMatch: any = {
      deleted: { $ne: true },
      status: LeaseStatus.TERMINATED,
      terminationDate: { $gte: period.startDate, $lte: period.endDate },
    };

    if (filterContext.tenantId) {
      leaseMatch.tenant = filterContext.tenantId;
    }

    pipeline.push({ $match: leaseMatch });

    // Filter by property if needed
    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      pipeline.push({
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      });

      pipeline.push({ $unwind: '$unitData' });

      pipeline.push({
        $match: {
          'unitData.property': { $in: filterContext.propertyIds },
          'unitData.deleted': { $ne: true },
        },
      });
    }

    pipeline.push({ $count: 'total' });

    const result = await this.leaseModel.aggregate(pipeline);
    return result.length > 0 ? result[0].total : 0;
  }

  private async getLeaseRenewalRate(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<LeaseRenewalRateDto> {
    const pipeline: any[] = [];

    // Find leases that ended in the period (expired or terminated)
    const leaseMatch: any = {
      deleted: { $ne: true },
      endDate: { $gte: period.startDate, $lte: period.endDate },
      status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRED, LeaseStatus.TERMINATED] },
    };

    if (filterContext.tenantId) {
      leaseMatch.tenant = filterContext.tenantId;
    }

    pipeline.push({ $match: leaseMatch });

    // Filter by property if needed
    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      pipeline.push({
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitData',
        },
      });

      pipeline.push({ $unwind: '$unitData' });

      pipeline.push({
        $match: {
          'unitData.property': { $in: filterContext.propertyIds },
          'unitData.deleted': { $ne: true },
        },
      });
    }

    const expiringLeases = await this.leaseModel.aggregate(pipeline);
    const expiringLeasesCount = expiringLeases.length;

    if (expiringLeasesCount === 0) {
      return {
        rate: 0,
        renewedLeases: 0,
        expiringLeases: 0,
        graphicalData: [
          { label: 'Renewed', value: 0 },
          { label: 'Not Renewed', value: 0 },
        ],
      };
    }

    // Check for renewals
    let renewedLeases = 0;

    for (const expiredLease of expiringLeases) {
      // Check if lease has autoRenewal flag
      if (expiredLease.autoRenewal) {
        renewedLeases++;
        continue;
      }

      // Check for new lease with same tenant on same unit within 30 days
      const renewalWindowEnd = new Date(expiredLease.endDate);
      renewalWindowEnd.setDate(renewalWindowEnd.getDate() + 30);

      const renewalMatch: any = {
        deleted: { $ne: true },
        unit: expiredLease.unit,
        tenant: expiredLease.tenant,
        status: LeaseStatus.ACTIVE,
        startDate: { $gte: expiredLease.endDate, $lte: renewalWindowEnd },
        _id: { $ne: expiredLease._id },
      };

      const renewalCount = await this.leaseModel.countDocuments(renewalMatch);
      if (renewalCount > 0) {
        renewedLeases++;
      }
    }

    const rate = (renewedLeases / expiringLeasesCount) * 100;

    return {
      rate,
      renewedLeases,
      expiringLeases: expiringLeasesCount,
      graphicalData: [
        { label: 'Renewed', value: renewedLeases },
        { label: 'Not Renewed', value: expiringLeasesCount - renewedLeases },
      ],
    };
  }

  private async getAverageVacancyDuration(
    filterContext: FilterContext,
    period: PeriodDates,
  ): Promise<number> {
    // Get all units in scope
    const unitMatch: any = { deleted: { $ne: true } };

    if (filterContext.propertyIds && filterContext.propertyIds.length > 0) {
      unitMatch.property = { $in: filterContext.propertyIds };
    }

    const units = await this.unitModel.find(unitMatch).select('_id').lean();
    const vacancyDurations: number[] = [];

    // For each unit, calculate vacancy periods
    for (const unit of units) {
      const leaseMatch: any = {
        deleted: { $ne: true },
        unit: unit._id,
        status: { $in: [LeaseStatus.ACTIVE, LeaseStatus.EXPIRED, LeaseStatus.TERMINATED] },
      };

      if (filterContext.tenantId) {
        leaseMatch.tenant = filterContext.tenantId;
      }

      // Get all leases for this unit, sorted by end date
      const leases = await this.leaseModel
        .find(leaseMatch)
        .sort({ endDate: 1 })
        .select('startDate endDate terminationDate status')
        .lean();

      // Calculate gaps between consecutive leases
      for (let i = 0; i < leases.length - 1; i++) {
        const currentLeaseEnd = leases[i].terminationDate || leases[i].endDate;
        const nextLeaseStart = leases[i + 1].startDate;

        if (currentLeaseEnd && nextLeaseStart) {
          const vacancyDays = differenceInDays(new Date(nextLeaseStart), new Date(currentLeaseEnd));

          // Only count positive vacancy periods within the specified period
          if (
            vacancyDays > 0 &&
            new Date(currentLeaseEnd) >= period.startDate &&
            new Date(currentLeaseEnd) <= period.endDate
          ) {
            vacancyDurations.push(vacancyDays);
          }
        }
      }
    }

    if (vacancyDurations.length === 0) {
      return 0;
    }

    const totalDuration = vacancyDurations.reduce((sum, duration) => sum + duration, 0);
    return Math.round(totalDuration / vacancyDurations.length);
  }

  private async buildFilterContext(query: OccupancyLeasingKPIQueryDto): Promise<FilterContext> {
    const context: FilterContext = {
      scope: query.scope,
    };

    if (query.tenantId) {
      context.tenantId = new Types.ObjectId(query.tenantId);
    }

    if (query.scope === OccupancyScope.PORTFOLIO) {
      // Get all properties for portfolio scope
      const properties = await this.propertyModel
        .find({ deleted: { $ne: true } })
        .select('_id')
        .lean();
      context.propertyIds = properties.map((p) => p._id as Types.ObjectId);
    } else if (query.scope === OccupancyScope.PROPERTY && query.propertyId) {
      context.propertyIds = [new Types.ObjectId(query.propertyId)];
    }

    return context;
  }

  private getPeriodDates(
    periodType: OccupancyPeriodType,
    customStartDate?: string,
    customEndDate?: string,
  ): PeriodDates {
    const now = new Date();

    switch (periodType) {
      case OccupancyPeriodType.THIS_MONTH:
        return {
          startDate: startOfMonth(now),
          endDate: endOfMonth(now),
        };

      case OccupancyPeriodType.LAST_MONTH: {
        const lastMonth = subMonths(now, 1);
        return {
          startDate: startOfMonth(lastMonth),
          endDate: endOfMonth(lastMonth),
        };
      }

      case OccupancyPeriodType.YEAR_TO_DATE:
        return {
          startDate: startOfYear(now),
          endDate: now,
        };

      case OccupancyPeriodType.ROLLING_12_MONTHS: {
        const twelveMonthsAgo = subMonths(now, 12);
        return {
          startDate: startOfMonth(twelveMonthsAgo),
          endDate: endOfMonth(now),
        };
      }

      case OccupancyPeriodType.CUSTOM:
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

  private getPreviousPeriod(
    currentPeriod: PeriodDates,
    periodType: OccupancyPeriodType,
  ): PeriodDates {
    switch (periodType) {
      case OccupancyPeriodType.THIS_MONTH:
      case OccupancyPeriodType.LAST_MONTH: {
        const prevMonth = subMonths(currentPeriod.startDate, 1);
        return {
          startDate: startOfMonth(prevMonth),
          endDate: endOfMonth(prevMonth),
        };
      }

      case OccupancyPeriodType.YEAR_TO_DATE: {
        const lastYear = new Date(currentPeriod.startDate);
        lastYear.setFullYear(lastYear.getFullYear() - 1);
        const lastYearSameDay = new Date(currentPeriod.endDate);
        lastYearSameDay.setFullYear(lastYearSameDay.getFullYear() - 1);
        return {
          startDate: lastYear,
          endDate: lastYearSameDay,
        };
      }

      case OccupancyPeriodType.ROLLING_12_MONTHS:
      case OccupancyPeriodType.CUSTOM: {
        const durationMs = currentPeriod.endDate.getTime() - currentPeriod.startDate.getTime();
        return {
          startDate: new Date(currentPeriod.startDate.getTime() - durationMs),
          endDate: new Date(currentPeriod.endDate.getTime() - durationMs),
        };
      }

      default: {
        const prevMonth = subMonths(currentPeriod.startDate, 1);
        return {
          startDate: startOfMonth(prevMonth),
          endDate: endOfMonth(prevMonth),
        };
      }
    }
  }

  private calculateGrowthRate(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return ((current - previous) / previous) * 100;
  }
}
