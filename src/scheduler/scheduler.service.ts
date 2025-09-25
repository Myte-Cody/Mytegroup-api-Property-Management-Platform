import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection } from 'mongoose';
import { LeasesService } from '../features/leases/services/leases.service';
import { StatusUpdaterService } from '../scripts/status-updater';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly leasesService: LeasesService,
  ) {}

  /**
   * Run status updates daily at 1:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyStatusUpdates() {
    this.logger.log('🚀 Running daily status updates...');

    try {
      const updater = new StatusUpdaterService(this.connection);
      const summary = await updater.executeStatusUpdates();

      this.logger.log(`✅ Status updates completed in ${summary.duration}`);
      this.logger.log(
        `📊 Summary: ${JSON.stringify({
          rentalPeriods: summary.rentalPeriods,
          leases: summary.leases,
          transactions: summary.transactions,
          units: summary.units,
        })}`,
      );

      if (summary.errors.length > 0) {
        this.logger.error(`❌ Errors: ${summary.errors.join(', ')}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to execute status updates: ${error.message}`, error.stack);
    }
  }

  /**
   * Send 30-day lease expiration warning emails at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async send30DayLeaseExpirationWarnings() {
    this.logger.log('📧 Sending 30-day lease expiration warning emails...');

    try {
      const today = new Date();
      await this.leasesService.sendLeaseExpirationWarningEmails(30, today);
      this.logger.log('✅ 30-day lease expiration warning emails sent successfully');
    } catch (error) {
      this.logger.error(
        `❌ Failed to send 30-day lease expiration warning emails: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send 15-day lease expiration warning emails at 2:15 AM
   */
  @Cron('15 2 * * *') // At 2:15 AM every day
  async send15DayLeaseExpirationWarnings() {
    this.logger.log('📧 Sending 15-day lease expiration warning emails...');

    try {
      const today = new Date();
      await this.leasesService.sendLeaseExpirationWarningEmails(15, today);
      this.logger.log('✅ 15-day lease expiration warning emails sent successfully');
    } catch (error) {
      this.logger.error(
        `❌ Failed to send 15-day lease expiration warning emails: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send 7-day lease expiration warning emails at 2:30 AM
   */
  @Cron('30 2 * * *') // At 2:30 AM every day
  async send7DayLeaseExpirationWarnings() {
    this.logger.log('📧 Sending 7-day lease expiration warning emails...');

    try {
      const today = new Date();
      await this.leasesService.sendLeaseExpirationWarningEmails(7, today);
      this.logger.log('✅ 7-day lease expiration warning emails sent successfully');
    } catch (error) {
      this.logger.error(
        `❌ Failed to send 7-day lease expiration warning emails: ${error.message}`,
        error.stack,
      );
    }
  }
}
