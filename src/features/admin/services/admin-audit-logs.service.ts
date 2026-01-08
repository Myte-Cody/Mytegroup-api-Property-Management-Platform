import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from '../../../common/schemas/audit-log.schema';
import { User } from '../../users/schemas/user.schema';
import { AdminAuditLogQueryDto, AdminPaginatedResponse } from '../dto/admin-query.dto';

@Injectable()
export class AdminAuditLogsService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLog>,
    @InjectModel(User.name) private userModel: Model<User>,
  ) {}

  async findAllAuditLogs(queryDto: AdminAuditLogQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      userId,
      action,
      startDate,
      endDate,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = {};

    // Filter by userId
    if (userId) {
      matchConditions.userId = userId;
    }

    // Filter by action (partial match)
    if (action) {
      matchConditions.action = { $regex: action, $options: 'i' };
    }

    // Search in action field
    if (search) {
      matchConditions.$or = [
        { action: { $regex: search, $options: 'i' } },
        { 'details.request.path': { $regex: search, $options: 'i' } },
      ];
    }

    // Date range filter
    if (startDate || endDate) {
      matchConditions.createdAt = {};
      if (startDate) {
        matchConditions.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        matchConditions.createdAt.$lte = new Date(endDate);
      }
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $addFields: {
          userObjectId: {
            $cond: {
              if: { $regexMatch: { input: '$userId', regex: /^[a-fA-F0-9]{24}$/ } },
              then: { $toObjectId: '$userId' },
              else: null,
            },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'userObjectId',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      {
        $addFields: {
          userName: {
            $concat: [
              { $ifNull: [{ $arrayElemAt: ['$userInfo.firstName', 0] }, 'Unknown'] },
              ' ',
              { $ifNull: [{ $arrayElemAt: ['$userInfo.lastName', 0] }, 'User'] },
            ],
          },
          userEmail: { $arrayElemAt: ['$userInfo.email', 0] },
        },
      },
      {
        $project: {
          userInfo: 0,
          userObjectId: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.auditLogModel.aggregate(countPipeline),
      this.auditLogModel.aggregate(dataPipeline),
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

  async findAuditLogById(id: string) {
    const auditLog = await this.auditLogModel.findById(id).lean();

    if (!auditLog) {
      throw new NotFoundException('Audit log not found');
    }

    // Try to get user info
    let userInfo = null;
    if (auditLog.userId && /^[a-fA-F0-9]{24}$/.test(auditLog.userId)) {
      userInfo = await this.userModel
        .findById(auditLog.userId)
        .select('firstName lastName email')
        .lean();
    }

    return {
      success: true,
      data: {
        ...auditLog,
        userName: userInfo ? `${userInfo.firstName} ${userInfo.lastName}` : 'Unknown User',
        userEmail: userInfo?.email || null,
      },
    };
  }
}
