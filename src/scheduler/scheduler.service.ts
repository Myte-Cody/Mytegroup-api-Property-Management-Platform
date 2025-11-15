import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Connection } from 'mongoose';
import { AuditLogService } from '../common/services/audit-log.service';
import { PaymentEmailService } from '../features/email/services/payment-email.service';
import { LeasesService } from '../features/leases/services/leases.service';
import { TransactionsService } from '../features/leases/services/transactions.service';
import { StatusUpdaterService } from '../scripts/status-updater';
import { LeaseEmailService } from './../features/email/services/lease-email.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly leasesService: LeasesService,
    private readonly transactionsService: TransactionsService,
    private readonly leaseEmailService: LeaseEmailService,
    private readonly paymentEmailService: PaymentEmailService,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Run status updates daily at 1:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async runDailyStatusUpdates() {
    this.logger.log('🚀 Running daily status updates...');
    const startTime = Date.now();

    try {
      const updater = new StatusUpdaterService(
        this.connection,
        this.leaseEmailService,
        this.paymentEmailService,
      );
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

      // Create audit log entry for successful execution
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'SchedulerService.runDailyStatusUpdates',
        details: {
          summary: {
            rentalPeriods: summary.rentalPeriods,
            leases: summary.leases,
            transactions: summary.transactions,
            units: summary.units,
            duration: summary.duration,
            executionTime: `${Date.now() - startTime}ms`,
          },
        },
      });

      if (summary.errors.length > 0) {
        this.logger.error(`❌ Errors: ${summary.errors.join(', ')}`);

        // Log errors separately
        await this.auditLogService.createLog({
          userId: 'system',
          action: 'SchedulerService.runDailyStatusUpdates.errors',
          details: {
            errors: summary.errors,
          },
        });
      }
    } catch (error) {
      this.logger.error(`❌ Failed to execute status updates: ${error.message}`, error.stack);

      // Log the error
      await this.auditLogService
        .createLog({
          userId: 'system',
          action: 'SchedulerService.runDailyStatusUpdates.failed',
          details: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            executionTime: `${Date.now() - startTime}ms`,
          },
        })
        .catch((logError) => {
          this.logger.error(`Failed to create audit log: ${logError.message}`);
        });
    }
  }

  /**
   * Send 30-day lease expiration warning emails at 2:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async send30DayLeaseExpirationWarnings() {
    this.logger.log('📧 Sending 30-day lease expiration warning emails...');
    const startTime = Date.now();

    try {
      const today = new Date();
      const result = await this.leasesService.sendLeaseExpirationWarningEmails(30, today);
      this.logger.log('✅ 30-day lease expiration warning emails sent successfully');

      // Create audit log entry for successful execution
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'SchedulerService.send30DayLeaseExpirationWarnings',
        details: {
          date: today,
          daysBeforeExpiration: 30,
          result,
          executionTime: `${Date.now() - startTime}ms`,
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to send 30-day lease expiration warning emails: ${error.message}`,
        error.stack,
      );

      // Log the error
      await this.auditLogService
        .createLog({
          userId: 'system',
          action: 'SchedulerService.send30DayLeaseExpirationWarnings.failed',
          details: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            executionTime: `${Date.now() - startTime}ms`,
          },
        })
        .catch((logError) => {
          this.logger.error(`Failed to create audit log: ${logError.message}`);
        });
    }
  }

  /**
   * Send 15-day lease expiration warning emails at 2:15 AM
   */
  @Cron('15 2 * * *') // At 2:15 AM every day
  async send15DayLeaseExpirationWarnings() {
    this.logger.log('📧 Sending 15-day lease expiration warning emails...');
    const startTime = Date.now();

    try {
      const today = new Date();
      const result = await this.leasesService.sendLeaseExpirationWarningEmails(15, today);
      this.logger.log('✅ 15-day lease expiration warning emails sent successfully');

      // Create audit log entry for successful execution
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'SchedulerService.send15DayLeaseExpirationWarnings',
        details: {
          date: today,
          daysBeforeExpiration: 15,
          result,
          executionTime: `${Date.now() - startTime}ms`,
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to send 15-day lease expiration warning emails: ${error.message}`,
        error.stack,
      );

      // Log the error
      await this.auditLogService
        .createLog({
          userId: 'system',
          action: 'SchedulerService.send15DayLeaseExpirationWarnings.failed',
          details: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            executionTime: `${Date.now() - startTime}ms`,
          },
        })
        .catch((logError) => {
          this.logger.error(`Failed to create audit log: ${logError.message}`);
        });
    }
  }

  /**
   * Send 7-day lease expiration warning emails at 2:30 AM
   */
  @Cron('30 2 * * *') // At 2:30 AM every day
  async send7DayLeaseExpirationWarnings() {
    this.logger.log('📧 Sending 7-day lease expiration warning emails...');
    const startTime = Date.now();

    try {
      const today = new Date();
      const result = await this.leasesService.sendLeaseExpirationWarningEmails(7, today);
      this.logger.log('✅ 7-day lease expiration warning emails sent successfully');

      // Create audit log entry for successful execution
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'SchedulerService.send7DayLeaseExpirationWarnings',
        details: {
          date: today,
          daysBeforeExpiration: 7,
          result,
          executionTime: `${Date.now() - startTime}ms`,
        },
      });
    } catch (error) {
      this.logger.error(
        `❌ Failed to send 7-day lease expiration warning emails: ${error.message}`,
        error.stack,
      );

      // Log the error
      await this.auditLogService
        .createLog({
          userId: 'system',
          action: 'SchedulerService.send7DayLeaseExpirationWarnings.failed',
          details: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            executionTime: `${Date.now() - startTime}ms`,
          },
        })
        .catch((logError) => {
          this.logger.error(`Failed to create audit log: ${logError.message}`);
        });
    }
  }

  /**
   * Send payment due reminders at 3:00 AM
   * Sends reminders for payments due in 7 days
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sendPaymentDueReminders() {
    this.logger.log('💰 Sending payment due reminders...');
    const startTime = Date.now();

    try {
      const today = new Date();
      const result = await this.transactionsService.sendPaymentDueReminders(today);
      this.logger.log('✅ Payment due reminders sent successfully');

      // Create audit log entry for successful execution
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'SchedulerService.sendPaymentDueReminders',
        details: {
          date: today,
          result,
          executionTime: `${Date.now() - startTime}ms`,
        },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to send payment due reminders: ${error.message}`, error.stack);

      // Log the error
      await this.auditLogService
        .createLog({
          userId: 'system',
          action: 'SchedulerService.sendPaymentDueReminders.failed',
          details: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            executionTime: `${Date.now() - startTime}ms`,
          },
        })
        .catch((logError) => {
          this.logger.error(`Failed to create audit log: ${logError.message}`);
        });
    }
  }

  /**
   * Send payment overdue notices at 3:30 AM
   * Sends notices for payments that are 2 days past due
   */
  @Cron('30 3 * * *') // At 3:30 AM every day
  async sendPaymentOverdueNotices() {
    this.logger.log('⚠️ Sending payment overdue notices...');
    const startTime = Date.now();

    try {
      const today = new Date();
      const result = await this.transactionsService.sendPaymentOverdueNotices(today);
      this.logger.log('✅ Payment overdue notices sent successfully');

      // Create audit log entry for successful execution
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'SchedulerService.sendPaymentOverdueNotices',
        details: {
          date: today,
          result,
          executionTime: `${Date.now() - startTime}ms`,
        },
      });
    } catch (error) {
      this.logger.error(`❌ Failed to send payment overdue notices: ${error.message}`, error.stack);

      // Log the error
      await this.auditLogService
        .createLog({
          userId: 'system',
          action: 'SchedulerService.sendPaymentOverdueNotices.failed',
          details: {
            error: {
              message: error.message,
              stack: error.stack,
            },
            executionTime: `${Date.now() - startTime}ms`,
          },
        })
        .catch((logError) => {
          this.logger.error(`Failed to create audit log: ${logError.message}`);
        });
    }
  }
}
