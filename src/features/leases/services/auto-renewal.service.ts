import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { LeaseStatus, RentalPeriodStatus } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { addDaysToDate, getToday } from '../../../common/utils/date.utils';
import { RenewalConfig } from '../../../config/renewal.config';
import { RenewLeaseDto } from '../dto/lease-operations.dto';
import { Lease } from '../schemas/lease.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { calculateRenewalDates, calculateRentIncrease } from '../utils/renewal.utils';
import { LeasesService } from './leases.service';

export interface RenewalResult {
  processed: number;
  successful: number;
  failed: number;
  errors: Array<{
    leaseId: string;
    error: string;
    tenantId: string;
  }>;
  details: Array<{
    leaseId: string;
    tenantId: string;
    oldEndDate: Date;
    newEndDate: Date;
    oldRent: number;
    newRent: number;
    action: 'renewed' | 'skipped' | 'error';
    reason?: string;
  }>;
}

@Injectable()
export class AutoRenewalService {
  private readonly logger = new Logger(AutoRenewalService.name);

  constructor(
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    private readonly leasesService: LeasesService,
    private readonly configService: ConfigService,
  ) {}

  async processAutoRenewals(configOverrides?: Partial<RenewalConfig>): Promise<RenewalResult> {
    const config = this.getConfig(configOverrides);
    const result: RenewalResult = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      details: [],
    };

    this.logger.log(`Starting auto-renewal process with config: ${JSON.stringify(config)}`);

    try {
      const eligibleLeases = await this.findEligibleLeases(config);

      this.logger.log(`Found ${eligibleLeases.length} eligible leases for auto-renewal`);
      result.processed = eligibleLeases.length;

      if (config.dryRun) {
        this.logger.warn('DRY RUN MODE - No actual renewals will be processed');
      }

      // Process renewals in batches
      for (let i = 0; i < eligibleLeases.length; i += config.batchSize) {
        const batch = eligibleLeases.slice(i, i + config.batchSize);
        await this.processBatch(batch, config, result);
      }

      this.logger.log(
        `Auto-renewal process completed. Successful: ${result.successful}, Failed: ${result.failed}`,
      );

      // TODO: Send notification summary to admins
      // TODO: Create audit log entry

      return result;
    } catch (error) {
      this.logger.error('Critical error in auto-renewal process:', error);
      throw error;
    }
  }

  private async findEligibleLeases(config: RenewalConfig): Promise<Lease[]> {
    const cutoffDate = addDaysToDate(new Date(), config.renewalWindowDays);

    const eligibleLeases = await this.leaseModel
      .find({
        status: LeaseStatus.ACTIVE,
        autoRenewal: true,
        endDate: { $lte: cutoffDate },
      })
      .populate({
        path: 'unit',
        populate: {
          path: 'property',
        },
      })
      .populate('tenant')
      .exec();

    // Filter to only include leases that have an active rental period but no future periods
    const filtered = [];
    for (const lease of eligibleLeases) {
      const hasActiveRentalPeriod = await this.rentalPeriodModel
        .findOne({
          lease: lease._id,
          status: RentalPeriodStatus.ACTIVE,
        })
        .exec();
      if (!hasActiveRentalPeriod) {
        continue;
      }

      const hasFutureRentalPeriod = await this.rentalPeriodModel
        .findOne({
          lease: lease._id,
          startDate: { $gt: getToday() },
          status: { $in: [RentalPeriodStatus.ACTIVE, RentalPeriodStatus.PENDING] },
        })
        .exec();

      if (!hasFutureRentalPeriod) {
        filtered.push(lease);
      }
    }

    return filtered;
  }

  private async processBatch(
    leases: Lease[],
    config: RenewalConfig,
    result: RenewalResult,
  ): Promise<void> {
    for (const lease of leases) {
      try {
        await this.processLeaseRenewal(lease, config, result);
      } catch (error) {
        this.logger.error(`Error processing lease ${lease._id}:`, error);
        result.failed++;
        const tenantIdentifier = (lease as any).tenantId?.toString() || 'unknown';
        result.errors.push({
          leaseId: lease._id.toString(),
          error: error.message,
          tenantId: tenantIdentifier,
        });
        result.details.push({
          leaseId: lease._id.toString(),
          tenantId: tenantIdentifier,
          oldEndDate: lease.endDate,
          newEndDate: lease.endDate,
          oldRent: lease.rentAmount,
          newRent: lease.rentAmount,
          action: 'error',
          reason: error.message,
        });
      }
    }
  }

  private async processLeaseRenewal(
    lease: Lease,
    config: RenewalConfig,
    result: RenewalResult,
  ): Promise<void> {
    const tenantIdentifier = (lease as any).tenantId?.toString() || 'unknown';

    this.logger.log(`Processing renewal for lease ${lease._id} (tenant: ${tenantIdentifier})`);

    const { startDate: newStartDate, endDate: newEndDate } = calculateRenewalDates(
      lease.endDate,
      config.defaultRenewalTermMonths,
    );

    const { newRentAmount, rentIncrease } = calculateRentIncrease(lease, config);

    const renewalData: RenewLeaseDto = {
      startDate: newStartDate,
      endDate: newEndDate,
    };

    if (config.dryRun) {
      this.logger.log(`DRY RUN: Would renew lease ${lease._id} with new rent: ${newRentAmount}`);
      result.details.push({
        leaseId: lease._id.toString(),
        tenantId: tenantIdentifier,
        oldEndDate: lease.endDate,
        newEndDate: newEndDate,
        oldRent: lease.rentAmount,
        newRent: newRentAmount,
        action: 'skipped',
        reason: 'Dry run mode',
      });
      return;
    }

    // Create a system user context for the renewal process
    const leaseContext = (lease as any).tenantId;
    this.logger.warn({ lease, leaseContext });

    if (!leaseContext) {
      this.logger.error(`No tenant context found for lease ${lease._id}`);
      throw new Error('No tenant context found for lease');
    }

    const systemUser = {
      _id: 'system-auto-renewal',
      tenantId: leaseContext,
      role: 'system',
      email: 'system@auto-renewal.local',
      user_type: 'Admin',
    } as any;

    try {
      const renewalResult = await this.leasesService.renewLease(
        lease._id.toString(),
        renewalData,
        systemUser,
      );

      this.logger.log(`Successfully renewed lease ${lease._id}`);
      result.successful++;
      result.details.push({
        leaseId: lease._id.toString(),
        tenantId: tenantIdentifier,
        oldEndDate: lease.endDate,
        newEndDate: renewalResult.newRentalPeriod.endDate,
        oldRent: lease.rentAmount,
        newRent: renewalResult.newRentalPeriod.rentAmount,
        action: 'renewed',
      });

      // TODO: Send renewal notification to landlord and tenant
      // TODO: Log renewal in audit system
    } catch (error) {
      console.log(error);
      if (error.message?.includes('An active rental period already exists')) {
        this.logger.warn(`Lease ${lease._id} appears to already be renewed, skipping`);
        result.details.push({
          leaseId: lease._id.toString(),
          tenantId: tenantIdentifier,
          oldEndDate: lease.endDate,
          newEndDate: lease.endDate,
          oldRent: lease.rentAmount,
          newRent: lease.rentAmount,
          action: 'skipped',
          reason: 'Already has active rental period',
        });
        return;
      }

      // Re-throw other errors to be handled by the caller
      throw error;
    }
  }

  async getRenewalPreview(configOverrides?: Partial<RenewalConfig>): Promise<RenewalResult> {
    // Force dry run for preview
    const previewConfig = { ...configOverrides, dryRun: true };
    return this.processAutoRenewals(previewConfig);
  }

  private getConfig(overrides?: Partial<RenewalConfig>): RenewalConfig {
    const defaultConfig = this.configService.get<RenewalConfig>('renewal');
    return {
      ...defaultConfig,
      ...overrides,
    };
  }
}
