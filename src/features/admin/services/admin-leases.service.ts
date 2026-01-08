import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lease } from '../../leases/schemas/lease.schema';
import { Transaction } from '../../leases/schemas/transaction.schema';
import {
  AdminLeaseQueryDto,
  AdminPaginatedResponse,
  AdminTransactionQueryDto,
} from '../dto/admin-query.dto';

@Injectable()
export class AdminLeasesService {
  constructor(
    @InjectModel(Lease.name) private leaseModel: Model<Lease>,
    @InjectModel(Transaction.name) private transactionModel: Model<Transaction>,
  ) {}

  async findAllLeases(queryDto: AdminLeaseQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
      status,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (landlordId) {
      matchConditions.landlord = new Types.ObjectId(landlordId);
    }

    if (status) {
      matchConditions.status = status;
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
          from: 'units',
          localField: 'unit',
          foreignField: '_id',
          as: 'unitInfo',
        },
      },
      {
        $lookup: {
          from: 'tenants',
          localField: 'tenant',
          foreignField: '_id',
          as: 'tenantInfo',
        },
      },
      {
        $lookup: {
          from: 'properties',
          localField: 'unitInfo.property',
          foreignField: '_id',
          as: 'propertyInfo',
        },
      },
      {
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          unitNumber: { $arrayElemAt: ['$unitInfo.unitNumber', 0] },
          tenantName: { $arrayElemAt: ['$tenantInfo.name', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          unitInfo: 0,
          tenantInfo: 0,
          propertyInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.leaseModel.aggregate(countPipeline),
      this.leaseModel.aggregate(dataPipeline),
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

  async findLeaseById(id: string) {
    const lease = await this.leaseModel
      .findById(id)
      .populate('landlord', 'name')
      .populate('unit', 'unitNumber type property')
      .populate('tenant', 'name')
      .lean();

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    // Get transaction summary
    const transactionSummary = await this.transactionModel.aggregate([
      {
        $match: {
          lease: new Types.ObjectId(id),
          deleted: { $ne: true },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    return {
      success: true,
      data: {
        ...lease,
        transactionSummary,
      },
    };
  }

  async findAllTransactions(queryDto: AdminTransactionQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
      status,
      type,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (landlordId) {
      matchConditions.landlord = new Types.ObjectId(landlordId);
    }

    if (status) {
      matchConditions.status = status;
    }

    if (type) {
      matchConditions.type = type;
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
          from: 'leases',
          localField: 'lease',
          foreignField: '_id',
          as: 'leaseInfo',
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
          from: 'properties',
          localField: 'property',
          foreignField: '_id',
          as: 'propertyInfo',
        },
      },
      {
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          unitNumber: { $arrayElemAt: ['$unitInfo.unitNumber', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          leaseInfo: 0,
          unitInfo: 0,
          propertyInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.transactionModel.aggregate(countPipeline),
      this.transactionModel.aggregate(dataPipeline),
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

  async findTransactionById(id: string) {
    const transaction = await this.transactionModel
      .findById(id)
      .populate('landlord', 'name')
      .populate('lease', 'startDate endDate rentAmount status')
      .populate('unit', 'unitNumber type')
      .populate('property', 'name address')
      .lean();

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return { success: true, data: transaction };
  }
}
