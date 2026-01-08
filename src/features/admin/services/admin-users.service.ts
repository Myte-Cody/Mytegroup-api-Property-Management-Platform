import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contractor } from '../../contractors/schema/contractor.schema';
import { Landlord } from '../../landlords/schema/landlord.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { Property } from '../../properties/schemas/property.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User } from '../../users/schemas/user.schema';
import { AdminPaginatedResponse, AdminQueryDto, AdminUserQueryDto } from '../dto/admin-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    @InjectModel(Landlord.name) private landlordModel: Model<Landlord>,
    @InjectModel(Tenant.name) private tenantModel: Model<Tenant>,
    @InjectModel(Contractor.name) private contractorModel: Model<Contractor>,
    @InjectModel(Property.name) private propertyModel: Model<Property>,
    @InjectModel(Lease.name) private leaseModel: Model<Lease>,
  ) {}

  async findAllUsers(queryDto: AdminUserQueryDto): Promise<AdminPaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      landlordId,
      userType,
    } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    if (landlordId) {
      matchConditions.organization_id = new Types.ObjectId(landlordId);
      matchConditions.user_type = 'Landlord';
    }

    if (userType) {
      matchConditions.user_type = userType;
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'landlords',
          localField: 'organization_id',
          foreignField: '_id',
          as: 'landlordInfo',
        },
      },
      {
        $lookup: {
          from: 'tenants',
          localField: 'organization_id',
          foreignField: '_id',
          as: 'tenantInfo',
        },
      },
      {
        $lookup: {
          from: 'contractors',
          localField: 'organization_id',
          foreignField: '_id',
          as: 'contractorInfo',
        },
      },
      {
        $addFields: {
          organizationName: {
            $switch: {
              branches: [
                {
                  case: { $eq: ['$user_type', 'Landlord'] },
                  then: { $arrayElemAt: ['$landlordInfo.name', 0] },
                },
                {
                  case: { $eq: ['$user_type', 'Tenant'] },
                  then: { $arrayElemAt: ['$tenantInfo.name', 0] },
                },
                {
                  case: { $eq: ['$user_type', 'Contractor'] },
                  then: { $arrayElemAt: ['$contractorInfo.name', 0] },
                },
              ],
              default: null,
            },
          },
        },
      },
      {
        $project: {
          password: 0,
          landlordInfo: 0,
          tenantInfo: 0,
          contractorInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [...pipeline.slice(0, 1), { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.userModel.aggregate(countPipeline),
      this.userModel.aggregate(dataPipeline),
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

  async findUserById(id: string) {
    const user = await this.userModel.findById(id).select('-password').lean();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { success: true, data: user };
  }

  async findAllLandlords(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;
    const skip = (page - 1) * limit;

    const matchConditions: any = { deleted: { $ne: true } };

    if (search) {
      matchConditions.name = { $regex: search, $options: 'i' };
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'users',
          let: { landlordId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization_id', '$$landlordId'] },
                    { $eq: ['$user_type', 'Landlord'] },
                    { $ne: ['$deleted', true] },
                  ],
                },
              },
            },
          ],
          as: 'users',
        },
      },
      {
        $lookup: {
          from: 'properties',
          let: { landlordId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [{ $eq: ['$landlord', '$$landlordId'] }, { $ne: ['$deleted', true] }],
                },
              },
            },
            { $count: 'count' },
          ],
          as: 'propertiesCount',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$users' },
          propertyCount: { $ifNull: [{ $arrayElemAt: ['$propertiesCount.count', 0] }, 0] },
        },
      },
      {
        $project: {
          users: 0,
          propertiesCount: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.landlordModel.aggregate(countPipeline),
      this.landlordModel.aggregate(dataPipeline),
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

  async findLandlordById(id: string) {
    const landlord = await this.landlordModel.findById(id).lean();

    if (!landlord) {
      throw new NotFoundException('Landlord not found');
    }

    const [users, propertyCount, activeLeaseCount] = await Promise.all([
      this.userModel
        .find({
          organization_id: new Types.ObjectId(id),
          user_type: 'Landlord',
          deleted: { $ne: true },
        })
        .select('-password')
        .lean(),
      this.propertyModel.countDocuments({
        landlord: new Types.ObjectId(id),
        deleted: { $ne: true },
      }),
      this.leaseModel.countDocuments({
        landlord: new Types.ObjectId(id),
        status: 'ACTIVE',
        deleted: { $ne: true },
      }),
    ]);

    return {
      success: true,
      data: {
        ...landlord,
        users,
        stats: {
          userCount: users.length,
          propertyCount,
          activeLeaseCount,
        },
      },
    };
  }

  async findAllTenants(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
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
      matchConditions.name = { $regex: search, $options: 'i' };
    }

    if (landlordId) {
      matchConditions.landlords = new Types.ObjectId(landlordId);
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'landlords',
          localField: 'landlords',
          foreignField: '_id',
          as: 'landlordDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { tenantId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization_id', '$$tenantId'] },
                    { $eq: ['$user_type', 'Tenant'] },
                    { $ne: ['$deleted', true] },
                  ],
                },
              },
            },
          ],
          as: 'users',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$users' },
          landlordNames: '$landlordDetails.name',
        },
      },
      {
        $project: {
          users: 0,
          landlordDetails: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.tenantModel.aggregate(countPipeline),
      this.tenantModel.aggregate(dataPipeline),
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

  async findTenantById(id: string) {
    const tenant = await this.tenantModel.findById(id).populate('landlords', 'name').lean();

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const users = await this.userModel
      .find({
        organization_id: new Types.ObjectId(id),
        user_type: 'Tenant',
        deleted: { $ne: true },
      })
      .select('-password')
      .lean();

    return {
      success: true,
      data: {
        ...tenant,
        users,
      },
    };
  }

  async findAllContractors(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
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
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    if (landlordId) {
      matchConditions.landlords = new Types.ObjectId(landlordId);
    }

    const pipeline: any[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'landlords',
          localField: 'landlords',
          foreignField: '_id',
          as: 'landlordDetails',
        },
      },
      {
        $lookup: {
          from: 'users',
          let: { contractorId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$organization_id', '$$contractorId'] },
                    { $eq: ['$user_type', 'Contractor'] },
                    { $ne: ['$deleted', true] },
                  ],
                },
              },
            },
          ],
          as: 'users',
        },
      },
      {
        $addFields: {
          userCount: { $size: '$users' },
          landlordNames: '$landlordDetails.name',
        },
      },
      {
        $project: {
          users: 0,
          landlordDetails: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.contractorModel.aggregate(countPipeline),
      this.contractorModel.aggregate(dataPipeline),
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

  async findContractorById(id: string) {
    const contractor = await this.contractorModel.findById(id).populate('landlords', 'name').lean();

    if (!contractor) {
      throw new NotFoundException('Contractor not found');
    }

    const users = await this.userModel
      .find({
        organization_id: new Types.ObjectId(id),
        user_type: 'Contractor',
        deleted: { $ne: true },
      })
      .select('-password')
      .lean();

    return {
      success: true,
      data: {
        ...contractor,
        users,
      },
    };
  }
}
