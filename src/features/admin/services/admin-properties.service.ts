import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lease } from '../../leases/schemas/lease.schema';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { AdminPaginatedResponse, AdminQueryDto } from '../dto/admin-query.dto';

@Injectable()
export class AdminPropertiesService {
  constructor(
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Unit.name) private unitModel: Model<Unit>,
    @InjectModel(Lease.name) private leaseModel: Model<Lease>,
  ) {}

  async findAllProperties(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.$or = [
        { name: { $regex: search, $options: 'i' } },
        { 'address.city': { $regex: search, $options: 'i' } },
        { 'address.state': { $regex: search, $options: 'i' } },
      ];
    }

    if (landlordId) {
      matchConditions.landlord = new Types.ObjectId(landlordId);
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
          let: { propertyId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$property', '$$propertyId'] }, { $ne: ['$deleted', true] }],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'unitsCount',
        },
      },
      {
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          unitCount: { $ifNull: [{ $arrayElemAt: ['$unitsCount.count', 0] }, 0] },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          unitsCount: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.propertyModel.aggregate(countPipeline),
      this.propertyModel.aggregate(dataPipeline),
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

  async findPropertyById(id: string) {
    const property = await this.propertyModel.findById(id).populate('landlord', 'name').lean();

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    const [unitCount, activeLeaseCount] = await Promise.all([
      this.unitModel.countDocuments({ property: new Types.ObjectId(id), deleted: { $ne: true } }),
      this.leaseModel.countDocuments({
        property: new Types.ObjectId(id),
        status: 'ACTIVE',
        deleted: { $ne: true },
      }),
    ]);

    return {
      success: true,
      data: {
        ...property,
        stats: {
          unitCount,
          activeLeaseCount,
        },
      },
    };
  }

  async findAllUnits(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.$or = [
        { unitNumber: { $regex: search, $options: 'i' } },
        { type: { $regex: search, $options: 'i' } },
      ];
    }

    if (landlordId) {
      matchConditions.landlord = new Types.ObjectId(landlordId);
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
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          propertyInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.unitModel.aggregate(countPipeline),
      this.unitModel.aggregate(dataPipeline),
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

  async findUnitById(id: string) {
    const unit = await this.unitModel
      .findById(id)
      .populate('landlord', 'name')
      .populate('property', 'name address')
      .lean();

    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const activeLease = await this.leaseModel
      .findOne({
        unit: new Types.ObjectId(id),
        status: 'ACTIVE',
        deleted: { $ne: true },
      })
      .populate('tenant', 'name')
      .lean();

    return {
      success: true,
      data: {
        ...unit,
        activeLease,
      },
    };
  }
}
