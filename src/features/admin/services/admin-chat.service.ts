import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ThreadMessage } from '../../maintenance/schemas/thread-message.schema';
import { Thread } from '../../maintenance/schemas/thread.schema';
import { Notification } from '../../notifications/schemas/notification.schema';
import { AdminPaginatedResponse, AdminQueryDto } from '../dto/admin-query.dto';

@Injectable()
export class AdminChatService {
  constructor(
    @InjectModel(Thread.name) private threadModel: Model<Thread>,
    @InjectModel(ThreadMessage.name) private messageModel: Model<ThreadMessage>,
    @InjectModel(Notification.name) private notificationModel: Model<Notification>,
  ) {}

  async findAllThreads(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.title = { $regex: search, $options: 'i' };
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'threadmessages',
          let: { threadId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$thread', '$$threadId'] }, { $ne: ['$isDeleted', true] }],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'messageCount',
        },
      },
      {
        $lookup: {
          from: 'threadparticipants',
          let: { threadId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ['$thread', '$$threadId'] },
              },
            },
            { $count: 'count' },
          ],
          as: 'participantCount',
        },
      },
      {
        $addFields: {
          messageCount: { $ifNull: [{ $arrayElemAt: ['$messageCount.count', 0] }, 0] },
          participantCount: { $ifNull: [{ $arrayElemAt: ['$participantCount.count', 0] }, 0] },
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.threadModel.aggregate(countPipeline),
      this.threadModel.aggregate(dataPipeline),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async findThreadById(id: string) {
    const thread = await this.threadModel
      .findById(id)
      .populate('createdBy', 'firstName lastName email')
      .lean();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Get last 50 messages for the thread (read-only view)
    const messages = await this.messageModel
      .find({
        thread: new Types.ObjectId(id),
        isDeleted: { $ne: true },
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('senderId', 'firstName lastName email')
      .lean();

    return {
      success: true,
      data: {
        ...thread,
        messages: messages.reverse(), // Show oldest to newest
      },
    };
  }

  async findAllNotifications(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $addFields: {
          userName: {
            $concat: [
              { $arrayElemAt: ['$userInfo.firstName', 0] },
              ' ',
              { $arrayElemAt: ['$userInfo.lastName', 0] },
            ],
          },
          userEmail: { $arrayElemAt: ['$userInfo.email', 0] },
        },
      },
      {
        $project: {
          userInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.notificationModel.aggregate(countPipeline),
      this.notificationModel.aggregate(dataPipeline),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }
}
