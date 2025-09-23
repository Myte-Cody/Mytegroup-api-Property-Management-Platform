import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../app.module';
import { LeaseStatus, PaymentStatus, RentalPeriodStatus } from '../common/enums/lease.enum';
import { UnitAvailabilityStatus } from '../common/enums/unit.enum';
import { getToday } from '../common/utils/date.utils';

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

class StatusUpdaterService {
  private connection: Connection;
  private summary: StatusUpdateSummary;

  constructor(connection: Connection) {
    this.connection = connection;
    this.summary = {
      executedAt: new Date().toISOString(),
      rentalPeriods: { pendingToActive: 0, activeToExpired: 0 },
      leases: { activeToExpired: 0 },
      transactions: { pendingToOverdue: 0 },
      units: { vacantToOccupied: 0, occupiedToVacant: 0 },
      errors: [],
      duration: '0s'
    };
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
            $in: await this.getActiveLeaseIds()
          }
        },
        {
          $set: { status: RentalPeriodStatus.ACTIVE }
        }
      );

      this.summary.rentalPeriods.pendingToActive = pendingToActiveResult.modifiedCount;
      console.log(`   → ${pendingToActiveResult.modifiedCount} periods: PENDING → ACTIVE`);

      // 2. ACTIVE → EXPIRED (periods that ended before today)
      const activeToExpiredResult = await this.connection.model('RentalPeriod').updateMany(
        {
          status: RentalPeriodStatus.ACTIVE,
          endDate: { $lt: today },
          lease: {
            $in: await this.getActiveLeaseIds()
          }
        },
        {
          $set: { status: RentalPeriodStatus.EXPIRED }
        }
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
        endDate: { $lt: today }
      });

      let expiredCount = 0;

      for (const lease of leasesToExpire) {
        // Check if lease has any active or pending rental periods
        const hasActiveOrPendingPeriods = await this.connection.model('RentalPeriod').exists({
          lease: lease._id,
          status: { $in: [RentalPeriodStatus.ACTIVE, RentalPeriodStatus.PENDING] }
        });

        // If no active/pending periods, expire the lease
        if (!hasActiveOrPendingPeriods) {
          await this.connection.model('Lease').updateOne(
            { _id: lease._id },
            { $set: { status: LeaseStatus.EXPIRED } }
          );
          expiredCount++;
        }
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

      // PENDING → OVERDUE (transactions past due date)
      const overdueResult = await this.connection.model('Transaction').updateMany(
        {
          status: PaymentStatus.PENDING,
          dueDate: { $lt: today },
          // Only update transactions belonging to ACTIVE leases
          lease: {
            $in: await this.getActiveLeaseIds()
          }
        },
        {
          $set: { status: PaymentStatus.OVERDUE }
        }
      );

      this.summary.transactions.pendingToOverdue = overdueResult.modifiedCount;
      console.log(`   → ${overdueResult.modifiedCount} transactions: PENDING → OVERDUE`);

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
          await this.connection.model('Unit').updateOne(
            { _id: unit._id },
            { $set: { availabilityStatus: UnitAvailabilityStatus.OCCUPIED } }
          );
          vacantToOccupied++;

        } else if (!hasActiveOccupancy && unit.availabilityStatus === UnitAvailabilityStatus.OCCUPIED) {
          // OCCUPIED → VACANT
          await this.connection.model('Unit').updateOne(
            { _id: unit._id },
            { $set: { availabilityStatus: UnitAvailabilityStatus.VACANT } }
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
    const activeLeases = await this.connection.model('Lease').find(
      { status: LeaseStatus.ACTIVE },
      '_id'
    );
    return activeLeases.map(lease => lease._id.toString());
  }

  private async hasActiveOccupancy(unitId: string): Promise<boolean> {
    // Check if unit has ACTIVE lease with ACTIVE rental period
    const activeLease = await this.connection.model('Lease').findOne({
      unit: unitId,
      status: LeaseStatus.ACTIVE
    });

    if (!activeLease) {
      return false;
    }

    // Check if this lease has an active rental period
    const activeRentalPeriod = await this.connection.model('RentalPeriod').exists({
      lease: activeLease._id,
      status: RentalPeriodStatus.ACTIVE
    });

    return !!activeRentalPeriod;
  }
}

async function main() {

  try {
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: false,
    });

    const connection = app.get(getConnectionToken());
    const updater = new StatusUpdaterService(connection);

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
      summary.errors.forEach(error => console.log(`  - ${error}`));
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