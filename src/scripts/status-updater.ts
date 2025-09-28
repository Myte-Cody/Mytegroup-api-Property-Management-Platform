import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { LeaseStatus, PaymentStatus, RentalPeriodStatus } from '../common/enums/lease.enum';
import { UnitAvailabilityStatus } from '../common/enums/unit.enum';
import { getToday } from '../common/utils/date.utils';
import { LeaseEmailService } from '../features/email/services/lease-email.service';
import { PaymentEmailService } from '../features/email/services/payment-email.service';

interface StatusUpdateSummary {
  executedAt: string;
  rentalPeriods: {
    pendingToActive: number;
    activeToExpired: number;
  };
  leases: {
    activeToExpired: number;
  };
  transactions: {
    pendingToOverdue: number;
  };
  units: {
    vacantToOccupied: number;
    occupiedToVacant: number;
  };
  errors: string[];
  duration: string;
}

//TODO: fix manual command to send queue jobs
class StatusUpdaterService {
  private connection: Connection;
  private summary: StatusUpdateSummary;
  private leaseEmailService: LeaseEmailService;
  private paymentEmailService: PaymentEmailService;

  constructor(
    connection: Connection,
    leaseEmailService: LeaseEmailService,
    paymentEmailService: PaymentEmailService,
  ) {
    this.connection = connection;
    this.leaseEmailService = leaseEmailService;
    this.paymentEmailService = paymentEmailService;
    this.summary = {
      executedAt: new Date().toISOString(),
      rentalPeriods: { pendingToActive: 0, activeToExpired: 0 },
      leases: { activeToExpired: 0 },
      transactions: { pendingToOverdue: 0 },
      units: { vacantToOccupied: 0, occupiedToVacant: 0 },
      errors: [],
      duration: '0s',
    };
  }
  private async notifyLeaseExpired(leaseId: string): Promise<void> {
    try {
      const lease = await this.connection
        .model('Lease')
        .findById(leaseId)
        .populate('unit tenant')
        .populate({
          path: 'unit',
          populate: { path: 'property' },
        });

      if (!lease) return;

      const unit = lease.unit as any;
      const property = unit?.property;
      const tenant = lease.tenant as any;
      const users = await this.connection
        .model('User')
        .find({
          party_id: tenant._id,
          user_type: 'Tenant',
        })
        .exec();
      await Promise.all(
        users.map((user) =>
          this.leaseEmailService.sendLeaseExpirationWarningEmail(
            {
              recipientName: tenant.name,
              recipientEmail: user.email,
              isTenant: true,
              propertyName: property?.name || 'Unknown Property',
              unitIdentifier: unit?.unitNumber || 'Unknown Unit',
              propertyAddress: property?.address || 'Unknown Address',
              leaseStartDate: lease.startDate,
              leaseEndDate: lease.endDate,
              daysRemaining: 0, // Already expired
            },
            { queue: true },
          ),
        ),
      );
    } catch (error) {
      console.error('Failed to send lease expired notification:', error);
      this.summary.errors.push(`Lease expiration notification failed: ${error.message}`);
    }
  }

  private async notifyPaymentOverdue(transactionId: string): Promise<void> {
    try {
      const transaction = await this.connection
        .model('Transaction')
        .findById(transactionId)
        .populate({
          path: 'lease',
          populate: [{ path: 'unit', populate: 'property' }, { path: 'tenant' }],
        });

      if (!transaction?.lease) return;

      const lease = transaction.lease as any;
      const unit = lease.unit;
      const property = unit?.property;
      const tenant = lease.tenant;

      const users = await this.connection
        .model('User')
        .find({
          party_id: tenant._id,
          user_type: 'Tenant',
        })
        .exec();
      await Promise.all(
        users.map((user) => {
          const today = new Date();
          const dueDate = new Date(transaction.dueDate);
          const daysLate = Math.floor(
            (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
          );
          this.paymentEmailService.sendPaymentOverdueEmail(
            {
              recipientName: tenant.name,
              recipientEmail: user.email,
              propertyName: property?.name || 'Unknown Property',
              unitIdentifier: unit?.unitNumber || 'Unknown Unit',
              amount: transaction.amount,
              dueDate: transaction.dueDate,
              daysLate: daysLate > 0 ? daysLate : 1,
              periodStartDate: transaction.periodStartDate,
              periodEndDate: transaction.periodEndDate,
            },
            { queue: true },
          );
        }),
      );
    } catch (error) {
      console.error('Failed to send payment overdue notification:', error);
      this.summary.errors.push(`Payment overdue notification failed: ${error.message}`);
    }
  }

  async executeStatusUpdates(): Promise<StatusUpdateSummary> {
    const startTime = Date.now();

    try {
      console.log('🚀 Starting status updates...');

      await this.updateRentalPeriods();
      await this.updateLeaseStatus();
      await this.updateTransactionStatus();
      await this.syncUnitAvailability();

      console.log('✅ Status updates completed successfully');
    } catch (error) {
      console.error('❌ Status update failed:', error);
      this.summary.errors.push(`Critical error: ${error.message}`);
    }

    const endTime = Date.now();
    this.summary.duration = `${((endTime - startTime) / 1000).toFixed(1)}s`;

    return this.summary;
  }

  private async updateRentalPeriods(): Promise<void> {
    console.log('📅 Updating rental periods...');

    try {
      const today = getToday();

      // 1. PENDING → ACTIVE (periods starting today or earlier)
      const pendingToActiveResult = await this.connection.model('RentalPeriod').updateMany(
        {
          status: RentalPeriodStatus.PENDING,
          startDate: { $lte: today },
          lease: {
            $in: await this.getActiveLeaseIds(),
          },
        },
        {
          $set: { status: RentalPeriodStatus.ACTIVE },
        },
      );

      this.summary.rentalPeriods.pendingToActive = pendingToActiveResult.modifiedCount;
      console.log(`   → ${pendingToActiveResult.modifiedCount} periods: PENDING → ACTIVE`);

      // 2. ACTIVE → EXPIRED (periods that ended before today)
      const activeToExpiredResult = await this.connection.model('RentalPeriod').updateMany(
        {
          status: RentalPeriodStatus.ACTIVE,
          endDate: { $lt: today },
          lease: {
            $in: await this.getActiveLeaseIds(),
          },
        },
        {
          $set: { status: RentalPeriodStatus.EXPIRED },
        },
      );

      this.summary.rentalPeriods.activeToExpired = activeToExpiredResult.modifiedCount;
      console.log(`   → ${activeToExpiredResult.modifiedCount} periods: ACTIVE → EXPIRED`);
    } catch (error) {
      console.error('❌ Error updating rental periods:', error);
      this.summary.errors.push(`Rental periods update failed: ${error.message}`);
    }
  }

  private async updateLeaseStatus(): Promise<void> {
    console.log('📋 Updating lease status...');

    try {
      const today = getToday();

      // Find ACTIVE leases that should be expired
      const leasesToExpire = await this.connection.model('Lease').find({
        status: LeaseStatus.ACTIVE,
        endDate: { $lt: today },
      });

      let expiredCount = 0;
      const expiredLeaseIds: string[] = [];

      // First, identify all leases that need to be expired
      for (const lease of leasesToExpire) {
        // Check if lease has any active or pending rental periods
        const hasActiveOrPendingPeriods = await this.connection.model('RentalPeriod').exists({
          lease: lease._id,
          status: { $in: [RentalPeriodStatus.ACTIVE, RentalPeriodStatus.PENDING] },
        });

        // If no active/pending periods, mark for expiration
        if (!hasActiveOrPendingPeriods) {
          expiredLeaseIds.push(lease._id);
        }
      }

      // Update all expired leases in a single operation
      if (expiredLeaseIds.length > 0) {
        const updateResult = await this.connection
          .model('Lease')
          .updateMany({ _id: { $in: expiredLeaseIds } }, { $set: { status: LeaseStatus.EXPIRED } });

        expiredCount = updateResult.modifiedCount;

        // Send notifications for expired leases
        await Promise.all(expiredLeaseIds.map((leaseId) => this.notifyLeaseExpired(leaseId)));
      }

      this.summary.leases.activeToExpired = expiredCount;
      console.log(`   → ${expiredCount} leases: ACTIVE → EXPIRED`);
    } catch (error) {
      console.error('❌ Error updating lease status:', error);
      this.summary.errors.push(`Lease status update failed: ${error.message}`);
    }
  }

  private async updateTransactionStatus(): Promise<void> {
    console.log('💰 Updating transaction status...');

    try {
      const today = getToday();

      // Find transactions that should be marked as OVERDUE
      const overdueTransactions = await this.connection.model('Transaction').find({
        status: PaymentStatus.PENDING,
        dueDate: { $lt: today },
        lease: { $in: await this.getActiveLeaseIds() },
      });

      if (overdueTransactions.length > 0) {
        // Update all overdue transactions in a single operation
        const updateResult = await this.connection
          .model('Transaction')
          .updateMany(
            { _id: { $in: overdueTransactions.map((t) => t._id) } },
            { $set: { status: PaymentStatus.OVERDUE } },
          );

        this.summary.transactions.pendingToOverdue = updateResult.modifiedCount;
        console.log(`   → ${updateResult.modifiedCount} transactions: PENDING → OVERDUE`);

        // Send notifications for overdue payments
        await Promise.all(overdueTransactions.map((tx) => this.notifyPaymentOverdue(tx._id)));
      } else {
        console.log('   → No transactions to mark as overdue');
      }
    } catch (error) {
      console.error('❌ Error updating transaction status:', error);
      this.summary.errors.push(`Transaction status update failed: ${error.message}`);
    }
  }

  private async syncUnitAvailability(): Promise<void> {
    console.log('🏠 Syncing unit availability...');

    try {
      const units = await this.connection.model('Unit').find({}, 'availabilityStatus');

      let vacantToOccupied = 0;
      let occupiedToVacant = 0;

      for (const unit of units) {
        const hasActiveOccupancy = await this.hasActiveOccupancy(unit._id);

        if (hasActiveOccupancy && unit.availabilityStatus === UnitAvailabilityStatus.VACANT) {
          // VACANT → OCCUPIED
          await this.connection
            .model('Unit')
            .updateOne(
              { _id: unit._id },
              { $set: { availabilityStatus: UnitAvailabilityStatus.OCCUPIED } },
            );
          vacantToOccupied++;
        } else if (
          !hasActiveOccupancy &&
          unit.availabilityStatus === UnitAvailabilityStatus.OCCUPIED
        ) {
          // OCCUPIED → VACANT
          await this.connection
            .model('Unit')
            .updateOne(
              { _id: unit._id },
              { $set: { availabilityStatus: UnitAvailabilityStatus.VACANT } },
            );
          occupiedToVacant++;
        }
      }

      this.summary.units.vacantToOccupied = vacantToOccupied;
      this.summary.units.occupiedToVacant = occupiedToVacant;
      console.log(`   → ${vacantToOccupied} units: VACANT → OCCUPIED`);
      console.log(`   → ${occupiedToVacant} units: OCCUPIED → VACANT`);
    } catch (error) {
      console.error('❌ Error syncing unit availability:', error);
      this.summary.errors.push(`Unit availability sync failed: ${error.message}`);
    }
  }

  private async getActiveLeaseIds(): Promise<string[]> {
    const activeLeases = await this.connection
      .model('Lease')
      .find({ status: LeaseStatus.ACTIVE }, '_id');
    return activeLeases.map((lease) => lease._id.toString());
  }

  private async hasActiveOccupancy(unitId: string): Promise<boolean> {
    // Check if unit has ACTIVE lease with ACTIVE rental period
    const activeLease = await this.connection.model('Lease').findOne({
      unit: unitId,
      status: LeaseStatus.ACTIVE,
    });

    if (!activeLease) {
      return false;
    }

    // Check if this lease has an active rental period
    const activeRentalPeriod = await this.connection.model('RentalPeriod').exists({
      lease: activeLease._id,
      status: RentalPeriodStatus.ACTIVE,
    });

    return !!activeRentalPeriod;
  }
}

async function main() {
  let app;
  try {
    app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    // Get the database connection
    const connection = app.get(getConnectionToken());

    // Get the required services
    const leaseEmailService = app.get(LeaseEmailService);
    const paymentEmailService = app.get(PaymentEmailService);

    // Initialize the status updater with all required dependencies
    const updater = new StatusUpdaterService(connection, leaseEmailService, paymentEmailService);

    // Execute the status updates
    const summary = await updater.executeStatusUpdates();

    console.log('\n📊 Update Summary:');
    console.log('================');
    console.log(`Executed at: ${summary.executedAt}`);
    console.log(`Duration: ${summary.duration}\n`);

    console.log('Rental Periods:');
    console.log(`  PENDING → ACTIVE: ${summary.rentalPeriods.pendingToActive}`);
    console.log(`  ACTIVE → EXPIRED: ${summary.rentalPeriods.activeToExpired}\n`);

    console.log('Leases:');
    console.log(`  ACTIVE → EXPIRED: ${summary.leases.activeToExpired}\n`);

    console.log('Transactions:');
    console.log(`  PENDING → OVERDUE: ${summary.transactions.pendingToOverdue}\n`);

    console.log('Units:');
    console.log(`  VACANT → OCCUPIED: ${summary.units.vacantToOccupied}`);
    console.log(`  OCCUPIED → VACANT: ${summary.units.occupiedToVacant}\n`);

    if (summary.errors.length > 0) {
      console.log('❌ Errors:');
      summary.errors.forEach((error) => console.log(`  - ${error}`));
      process.exit(1);
    }

    await app.close();
    console.log('✅ Status update completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to execute status update:', error);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Status Updater Script
====================

Updates the status of rental periods, leases, transactions, and units.

Usage:
  npm run status:update
  npx ts-node src/scripts/status-updater.ts

Options:
  --help, -h    Show this help message

What it does:
  1. Updates rental periods: PENDING → ACTIVE, ACTIVE → EXPIRED
  2. Updates leases: ACTIVE → EXPIRED (when no active periods)
  3. Updates transactions: PENDING → OVERDUE (past due date)
  4. Syncs unit availability: VACANT ↔ OCCUPIED (based on lease status)

Note: Only processes ACTIVE leases (excludes TERMINATED and DRAFT leases)
  `);
  process.exit(0);
}

// Execute the script
if (require.main === module) {
  main();
}

export { StatusUpdaterService };
