import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { RenewalConfig } from '../../../config/renewal.config';
import { LeaseStatus, RentalPeriodStatus } from '../../../common/enums/lease.enum';
import { Lease } from '../schemas/lease.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { LeasesService } from './leases.service';
import { RenewLeaseDto } from '../dto/lease-operations.dto';

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
      // Find eligible leases for renewal
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

      this.logger.log(`Auto-renewal process completed. Successful: ${result.successful}, Failed: ${result.failed}`);

      // TODO: Send notification summary to admins
      // TODO: Create audit log entry

      return result;

    } catch (error) {
      this.logger.error('Critical error in auto-renewal process:', error);
      throw error;
    }
  }

  private async findEligibleLeases(config: RenewalConfig): Promise<Lease[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + config.renewalWindowDays);

    const eligibleLeases = await this.leaseModel
      .find({
        status: LeaseStatus.ACTIVE,
        autoRenewal: true,
        endDate: { $gte: new Date(cutoffDate) },
      })
      .populate('unit')
      .populate('tenant')
      .populate('property')
      .exec();


    // Filter to only include leases that have an active rental period but no future periods
    const filtered = [];
    for (const lease of eligibleLeases) {
      // Check if lease has an active rental period (required for renewal)
      const hasActiveRentalPeriod = await this.rentalPeriodModel
        .findOne({
          lease: lease._id,
          status: RentalPeriodStatus.ACTIVE,
        })
        .exec();
      if (!hasActiveRentalPeriod) {
        // Skip leases without active rental periods
        continue;
      }

      // Check if lease already has future renewal periods
      const hasFutureRentalPeriod = await this.rentalPeriodModel
        .findOne({
          lease: lease._id,
          startDate: { $gt: new Date() }, // Future start date
          status: { $in: [RentalPeriodStatus.ACTIVE, RentalPeriodStatus.PENDING] },
        })
        .exec();

      if (!hasFutureRentalPeriod) {
        // Only include leases with active periods but no future renewals
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
        const tenantIdentifier = (lease as any).tenant_id?.toString() || 'unknown';
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
    // Get tenant ID from the lease's tenant_id field (mongo-tenant plugin)
    const tenantIdentifier = (lease as any).tenant_id?.toString() || 'unknown';

    this.logger.log(`Processing renewal for lease ${lease._id} (tenant: ${tenantIdentifier})`);

    // Calculate new lease dates
    const newStartDate = new Date(lease.endDate);
    newStartDate.setDate(newStartDate.getDate() + 1); // Start the day after current lease ends

    const newEndDate = new Date(newStartDate);
    newEndDate.setMonth(newEndDate.getMonth() + config.defaultRenewalTermMonths);
    newEndDate.setDate(newEndDate.getDate() - 1); // End the day before next term starts

    // Calculate rent increase (if any)
    const { newRentAmount, rentIncrease } = this.calculateRentIncrease(lease, config);

    // Prepare renewal data
    // We can pass either rentIncrease OR rentAmount, renewLease will handle both cases
    const renewalData: RenewLeaseDto = {
      startDate: newStartDate,
      endDate: newEndDate,
      // Pass rentIncrease if we have one, otherwise renewLease will use current rent
      ...(rentIncrease && { rentIncrease }),
      // Optionally pass explicit rentAmount if no rent increase logic applies
      ...(rentIncrease === null && newRentAmount !== lease.rentAmount && { rentAmount: newRentAmount }),
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
    // This ensures proper tenant isolation during renewal
    // The mongo-tenant plugin adds tenant_id to the document
    const leaseContext = (lease as any).tenantId;
    this.logger.warn({lease, leaseContext})
    
    if (!leaseContext) {
      this.logger.error(`No tenant context found for lease ${lease._id}`);
      throw new Error('No tenant context found for lease');
    }
    
    const systemUser = {
      _id: 'system-auto-renewal',
      tenantId: leaseContext,
      role: 'system',
      email: 'system@auto-renewal.local',
      user_type: 'Admin'
    } as any;

    // Execute the renewal
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
      console.log(error)
      // Handle specific duplicate key error (lease already renewed)
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

  private calculateRentIncrease(lease: Lease, config: RenewalConfig) {
    let newRentAmount = lease.rentAmount;
    let rentIncrease = null;

    // Check if lease has predefined rent increase settings
    if (lease.rentIncrease) {
      rentIncrease = {
        type: lease.rentIncrease.type,
        amount: lease.rentIncrease.amount,
        reason: lease.rentIncrease.reason || 'Auto-renewal rent increase',
      };

      if (lease.rentIncrease.type === 'PERCENTAGE') {
        newRentAmount = lease.rentAmount * (1 + lease.rentIncrease.amount / 100);
      } else {
        newRentAmount = lease.rentAmount + lease.rentIncrease.amount;
      }
    } else if (config.defaultRentIncreasePercentage > 0) {
      // Apply default rent increase if configured
      const increaseAmount = config.defaultRentIncreasePercentage;

      // Check if increase is within allowed limits
      if (increaseAmount <= config.maxRentIncreasePercentage) {
        rentIncrease = {
          type: 'PERCENTAGE' as const,
          amount: increaseAmount,
          reason: 'Automatic annual rent increase',
        };
        newRentAmount = lease.rentAmount * (1 + increaseAmount / 100);
      }
    }

    // Ensure rent increase doesn't exceed maximum allowed
    const maxAllowedRent = lease.rentAmount * (1 + config.maxRentIncreasePercentage / 100);
    if (newRentAmount > maxAllowedRent) {
      this.logger.warn(`Rent increase for lease ${lease._id} exceeds maximum allowed. Capping at ${config.maxRentIncreasePercentage}%`);
      newRentAmount = maxAllowedRent;
      if (rentIncrease) {
        rentIncrease.amount = config.maxRentIncreasePercentage;
        rentIncrease.reason += ' (capped at maximum allowed increase)';
      }
    }

    return { newRentAmount: Math.round(newRentAmount * 100) / 100, rentIncrease };
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