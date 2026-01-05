import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  getCategoriesByRole,
  getNotificationTypesByCategory,
  NotificationChannel,
  NOTIFICATION_TYPE_METADATA,
  NotificationType,
  UserType,
} from '@shared/notification-types';
import {
  NotificationPreference,
  NotificationPreferenceDocument,
} from './schemas/notification-preference.schema';

@Injectable()
export class NotificationPreferencesService {
  private readonly logger = new Logger(NotificationPreferencesService.name);

  constructor(
    @InjectModel(NotificationPreference.name)
    private preferenceModel: Model<NotificationPreferenceDocument>,
  ) {}

  /**
   * Get all notification preferences for a user
   */
  async getUserPreferences(
    userId: string,
  ): Promise<NotificationPreferenceDocument[]> {
    return this.preferenceModel
      .find({ userId: new Types.ObjectId(userId) })
      .exec();
  }

  /**
   * Update or create a single preference
   */
  async upsertPreference(
    userId: string,
    notificationType: NotificationType,
    channels: { inApp?: boolean; email?: boolean; sms?: boolean },
  ): Promise<NotificationPreferenceDocument> {
    const preference = await this.preferenceModel.findOneAndUpdate(
      {
        userId: new Types.ObjectId(userId),
        notificationType,
      },
      {
        $set: {
          ...(channels.inApp !== undefined && { inApp: channels.inApp }),
          ...(channels.email !== undefined && { email: channels.email }),
          ...(channels.sms !== undefined && { sms: channels.sms }),
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );

    return preference;
  }

  /**
   * Bulk update preferences for a user
   */
  async bulkUpdatePreferences(
    userId: string,
    preferences: Array<{
      notificationType: NotificationType;
      inApp?: boolean;
      email?: boolean;
      sms?: boolean;
    }>,
  ): Promise<void> {
    const bulkOps = preferences.map((pref) => ({
      updateOne: {
        filter: {
          userId: new Types.ObjectId(userId),
          notificationType: pref.notificationType,
        },
        update: {
          $set: {
            ...(pref.inApp !== undefined && { inApp: pref.inApp }),
            ...(pref.email !== undefined && { email: pref.email }),
            ...(pref.sms !== undefined && { sms: pref.sms }),
          },
        },
        upsert: true,
      },
    }));

    if (bulkOps.length > 0) {
      await this.preferenceModel.bulkWrite(bulkOps);
    }
  }

  /**
   * Check if a notification should be sent on a specific channel
   * Falls back to default if no preference exists
   */
  async shouldSendNotification(
    userId: string,
    notificationType: NotificationType,
    channel: NotificationChannel,
  ): Promise<boolean> {
    try {
      const preference = await this.preferenceModel.findOne({
        userId: new Types.ObjectId(userId),
        notificationType,
      });

      if (preference) {
        switch (channel) {
          case NotificationChannel.IN_APP:
            return preference.inApp;
          case NotificationChannel.EMAIL:
            return preference.email;
          case NotificationChannel.SMS:
            return preference.sms;
          default:
            return false;
        }
      }

      // Fallback to default if no preference exists
      const metadata = NOTIFICATION_TYPE_METADATA[notificationType];
      if (metadata) {
        return metadata.defaultChannels[channel];
      }

      // Default to sending if metadata doesn't exist (shouldn't happen)
      this.logger.warn(
        `No metadata found for notification type: ${notificationType}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Error checking notification preference for user ${userId}, type ${notificationType}, channel ${channel}`,
        error,
      );
      // On error, default to sending the notification
      return true;
    }
  }

  /**
   * Initialize default preferences for a user based on their role
   */
  async initializeDefaults(
    userId: string,
    userType: UserType,
  ): Promise<void> {
    const categories = getCategoriesByRole(userType);
    const notificationTypes: NotificationType[] = [];

    // Get all notification types for the user's role
    categories.forEach((category) => {
      const typesForCategory = getNotificationTypesByCategory(category);
      notificationTypes.push(...typesForCategory);
    });

    // Filter to only include types applicable to this role
    const applicableTypes = notificationTypes.filter((type) => {
      const metadata = NOTIFICATION_TYPE_METADATA[type];
      return metadata && metadata.applicableRoles.includes(userType);
    });

    // Create default preferences
    const bulkOps = applicableTypes.map((type) => {
      const metadata = NOTIFICATION_TYPE_METADATA[type];
      return {
        updateOne: {
          filter: {
            userId: new Types.ObjectId(userId),
            notificationType: type,
          },
          update: {
            $setOnInsert: {
              userId: new Types.ObjectId(userId),
              notificationType: type,
              inApp: metadata.defaultChannels[NotificationChannel.IN_APP],
              email: metadata.defaultChannels[NotificationChannel.EMAIL],
              sms: metadata.defaultChannels[NotificationChannel.SMS],
            },
          },
          upsert: true,
        },
      };
    });

    if (bulkOps.length > 0) {
      await this.preferenceModel.bulkWrite(bulkOps);
      this.logger.log(
        `Initialized ${bulkOps.length} default preferences for user ${userId} (${userType})`,
      );
    }
  }

  /**
   * Delete all preferences for a user (useful for cleanup)
   */
  async deleteUserPreferences(userId: string): Promise<number> {
    const result = await this.preferenceModel.deleteMany({
      userId: new Types.ObjectId(userId),
    });
    return result.deletedCount;
  }
}
