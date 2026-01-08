import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Task } from '../../tasks/schemas/task.schema';
import { AdminMaintenanceQueryDto, AdminPaginatedResponse } from '../dto/admin-query.dto';

@Injectable()
export class AdminTasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<Task>) {}

  async findAllTasks(queryDto: AdminMaintenanceQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
      status,
      priority,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    if (landlordId) {
      matchConditions.landlord = new Types.ObjectId(landlordId);
    }

    if (status) {
      matchConditions.status = status;
    }

    if (priority) {
      matchConditions.priority = priority;
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'landlords',
          localField: 'landlord',
          foreignField: '_id',
          as: 'landlordInfo',
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'property',
          foreignField: '_id',
          as: 'propertyInfo',
        },
      },
      {
        $lookup: {
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitInfo',
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: 'createdBy',
          foreignField: '_id',
          as: 'createdByInfo',
        },
      },
      {
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
          unitNumber: { $arrayElemAt: ['$unitInfo.unitNumber', 0] },
          createdByName: {
            $concat: [
              { $arrayElemAt: ['$createdByInfo.firstName', 0] },
              ' ',
              { $arrayElemAt: ['$createdByInfo.lastName', 0] },
            ],
          },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          propertyInfo: 0,
          unitInfo: 0,
          createdByInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.taskModel.aggregate(countPipeline),
      this.taskModel.aggregate(dataPipeline),
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

  async findTaskById(id: string) {
    const task = await this.taskModel
      .findById(id)
      .populate('landlord', 'name')
      .populate('property', 'name address')
      .populate('unit', 'unitNumber type')
      .populate('tenant', 'name')
      .populate('createdBy', 'firstName lastName email')
      .populate('assignedParty', 'firstName lastName email')
      .lean();

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return { success: true, data: task };
  }
}
