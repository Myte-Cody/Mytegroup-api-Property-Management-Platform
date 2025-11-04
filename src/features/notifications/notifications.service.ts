import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<NotificationDocument>,
    private notificationsGateway: NotificationsGateway,
  ) {}

  // Create a notification and emit it to the user in real-time
  async createNotification(
    userId: string | Types.ObjectId,
    title: string,
    content: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.create({
      userId: new Types.ObjectId(userId),
      title,
      content,
      readAt: null,
    });

    // Emit real-time notification to the user
    this.notificationsGateway.emitToUser(
      userId.toString(),
      'notification:new',
      {
        id: notification._id,
        title: notification.title,
        content: notification.content,
        readAt: notification.readAt,
        createdAt: (notification as any).createdAt,
      },
    );

    return notification;
  }

  // Get all notifications for a user with pagination
  async getUserNotifications(
    userId: string,
    limit: number = 20,
    offset: number = 0,
    unreadOnly: boolean = false,
  ) {
    const filter: any = { userId: new Types.ObjectId(userId) };

    if (unreadOnly) {
      filter.readAt = null;
    }

    const [notifications, total] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      data: notifications,
      total,
      limit,
      offset,
      hasMore: offset + notifications.length < total,
    };
  }

  // Mark a notification as read
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (!notification.readAt) {
      notification.readAt = new Date();
      await notification.save();

      // Emit update to the user
      this.notificationsGateway.emitToUser(userId, 'notification:read', {
        id: notification._id,
        readAt: notification.readAt,
      });
    }

    return notification;
  }

  // Mark all notifications as read for a user
  async markAllAsRead(userId: string): Promise<{ modifiedCount: number }> {
    const result = await this.notificationModel.updateMany(
      {
        userId: new Types.ObjectId(userId),
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      },
    );

    // Emit update to the user
    this.notificationsGateway.emitToUser(userId, 'notification:allRead', {
      modifiedCount: result.modifiedCount,
    });

    return { modifiedCount: result.modifiedCount };
  }

  // Get unread count for a user
  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      userId: new Types.ObjectId(userId),
      readAt: null,
    });
  }

  // Delete a notification
  async deleteNotification(
    notificationId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.notificationModel.deleteOne({
      _id: new Types.ObjectId(notificationId),
      userId: new Types.ObjectId(userId),
    });

    if (result.deletedCount === 0) {
      throw new NotFoundException('Notification not found');
    }

    // Emit delete event to the user
    this.notificationsGateway.emitToUser(userId, 'notification:deleted', {
      id: notificationId,
    });
  }

  // Helper method to emit custom events
  async emitEvent(userId: string, event: string, data: any): Promise<void> {
    this.notificationsGateway.emitToUser(userId, event, data);
  }

  // Helper method to emit to multiple users
  async emitEventToUsers(
    userIds: string[],
    event: string,
    data: any,
  ): Promise<void> {
    this.notificationsGateway.emitToUsers(userIds, event, data);
  }
}
