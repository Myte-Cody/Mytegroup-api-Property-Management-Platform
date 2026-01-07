import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationType } from '@shared/notification-types';
import { Model, Types } from 'mongoose';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { NotificationDispatcherService } from '../../notifications/notification-dispatcher.service';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { ScheduleDocument, ScheduleType } from '../schemas/schedule.schema';
import { SchedulesService } from './schedules.service';

@Injectable()
export class ScheduleReminderService {
  private readonly logger = new Logger(ScheduleReminderService.name);

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    private readonly auditLogService: AuditLogService,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  /**
   * Process schedule reminders - called by the scheduler service daily
   */
  async processScheduleReminders(): Promise<{
    processed: number;
    reminderseSent: number;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let processed = 0;
    let remindersSent = 0;

    try {
      // Find schedules that need reminders
      const schedules = await this.schedulesService.findSchedulesNeedingReminders();
      this.logger.log(`Found ${schedules.length} schedules needing reminders`);

      for (const schedule of schedules) {
        try {
          const sent = await this.processScheduleReminder(schedule);
          if (sent) {
            remindersSent++;
            await this.schedulesService.markReminderSent(schedule._id.toString());
          }
          processed++;
        } catch (error) {
          errors.push(`Schedule ${schedule._id}: ${error.message}`);
          this.logger.error(`Error processing reminder for schedule ${schedule._id}`, error);
        }
      }

      // Log audit entry
      await this.auditLogService.createLog({
        userId: 'system',
        action: 'ScheduleReminderService.processScheduleReminders',
        details: {
          processed,
          remindersSent,
          errors,
          executionTime: `${Date.now() - startTime}ms`,
        },
      });

      return { processed, reminderseSent: remindersSent, errors };
    } catch (error) {
      this.logger.error('Failed to process schedule reminders', error);
      throw error;
    }
  }

  /**
   * Process a single schedule reminder
   */
  private async processScheduleReminder(schedule: ScheduleDocument): Promise<boolean> {
    const now = new Date();
    const targetDate = schedule.nextOccurrence || schedule.scheduledDate;
    const daysUntil = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Only send if within the reminder window
    if (daysUntil < 0 || daysUntil > schedule.reminderDaysBefore) {
      return false;
    }

    // Check if reminder was already sent for this occurrence
    if (schedule.lastReminderSentAt) {
      const lastReminderDate = new Date(schedule.lastReminderSentAt);
      const hoursSinceLastReminder =
        (now.getTime() - lastReminderDate.getTime()) / (1000 * 60 * 60);

      // Don't send if we sent a reminder in the last 20 hours
      if (hoursSinceLastReminder < 20) {
        return false;
      }
    }

    // Get tenants for this schedule
    const tenantOrgIds = await this.schedulesService.getTenantsForSchedule(schedule);

    if (tenantOrgIds.length === 0) {
      this.logger.debug(`No tenants found for schedule ${schedule._id}`);
      return false;
    }

    // Get all users for these tenant organizations
    const users = await this.userModel
      .find({
        organization_id: { $in: tenantOrgIds.map((id) => new Types.ObjectId(id)) },
        user_type: 'Tenant',
        isDisabled: { $ne: true },
      })
      .exec();

    if (users.length === 0) {
      this.logger.debug(`No active tenant users found for schedule ${schedule._id}`);
      return false;
    }

    // Build notification content
    const typeLabel = schedule.type === ScheduleType.GARBAGE ? 'Garbage' : 'Recycling';
    const propertyName = (schedule.property as any)?.name || 'your property';
    const unitNumber = (schedule.unit as any)?.unitNumber;

    let title = `${typeLabel} Collection Reminder`;
    let content: string;

    if (daysUntil === 0) {
      content = `${typeLabel} collection is TODAY at ${propertyName}${unitNumber ? ` (Unit ${unitNumber})` : ''}.`;
    } else if (daysUntil === 1) {
      content = `${typeLabel} collection is TOMORROW at ${propertyName}${unitNumber ? ` (Unit ${unitNumber})` : ''}.`;
    } else {
      content = `${typeLabel} collection in ${daysUntil} days at ${propertyName}${unitNumber ? ` (Unit ${unitNumber})` : ''}.`;
    }

    if (schedule.scheduledTime) {
      content += ` Collection time: ${schedule.scheduledTime}.`;
    }

    if (schedule.description) {
      content += ` Note: ${schedule.description}`;
    }

    // Send notifications to all tenant users
    let sentCount = 0;
    for (const user of users) {
      try {
        await this.notificationDispatcher.sendNotification({
          userId: user._id.toString(),
          notificationType: NotificationType.SCHEDULE_REMINDER,
          title,
          content,
          actionUrl: `/schedules/${schedule._id}`,
        });
        sentCount++;
      } catch (error) {
        this.logger.error(`Failed to send reminder to user ${user._id}`, error);
      }
    }

    this.logger.log(
      `Sent ${sentCount} reminders for schedule ${schedule._id} (${typeLabel} at ${propertyName})`,
    );

    return sentCount > 0;
  }
}
