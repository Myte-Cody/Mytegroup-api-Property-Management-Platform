import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MaintenanceTicket } from '../../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../../maintenance/schemas/scope-of-work.schema';
import { VisitRequest } from '../../maintenance/schemas/visit-request.schema';
import {
  AdminMaintenanceQueryDto,
  AdminPaginatedResponse,
  AdminQueryDto,
} from '../dto/admin-query.dto';

@Injectable()
export class AdminMaintenanceService {
  constructor(
    @InjectModel(MaintenanceTicket.name) private ticketModel: Model<MaintenanceTicket>,
    @InjectModel(ScopeOfWork.name) private sowModel: Model<ScopeOfWork>,
    @InjectModel(VisitRequest.name) private visitRequestModel: Model<VisitRequest>,
  ) {}

  async findAllTickets(queryDto: AdminMaintenanceQueryDto): Promise<AdminPaginatedResponse> {
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
        { ticketNumber: { $regex: search, $options: 'i' } },
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
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
          unitNumber: { $arrayElemAt: ['$unitInfo.unitNumber', 0] },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          propertyInfo: 0,
          unitInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.ticketModel.aggregate(countPipeline),
      this.ticketModel.aggregate(dataPipeline),
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

  async findTicketById(id: string) {
    const ticket = await this.ticketModel
      .findById(id)
      .populate('landlord', 'name')
      .populate('property', 'name address')
      .populate('unit', 'unitNumber type')
      .populate('assignedContractor', 'name category')
      .populate('requestedBy', 'firstName lastName email')
      .lean();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    return { success: true, data: ticket };
  }

  async findAllSows(queryDto: AdminMaintenanceQueryDto): Promise<AdminPaginatedResponse> {
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

    if (search) {
      matchConditions.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { sowNumber: { $regex: search, $options: 'i' } },
      ];
    }

    if (status) {
      matchConditions.status = status;
    }

    // SOWs don't have direct landlord field, we need to join via property
    const pipeline: any[] = [
      { $match: matchConditions },
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
          from: 'landlords',
          localField: 'propertyInfo.landlord',
          foreignField: '_id',
          as: 'landlordInfo',
        },
      },
      {
        $lookup: {
          from: 'contractors',
          localField: 'assignedContractor',
          foreignField: '_id',
          as: 'contractorInfo',
        },
      },
      {
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
          contractorName: { $arrayElemAt: ['$contractorInfo.name', 0] },
        },
      },
    ];

    // Apply landlord filter after lookup
    if (landlordId) {
      pipeline.push({
        $match: { 'propertyInfo.landlord': new Types.ObjectId(landlordId) },
      });
    }

    pipeline.push(
      {
        $project: {
          landlordInfo: 0,
          propertyInfo: 0,
          contractorInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    );

    const countPipeline = [...pipeline.slice(0, landlordId ? 5 : 4), { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.sowModel.aggregate(countPipeline),
      this.sowModel.aggregate(dataPipeline),
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

  async findSowById(id: string) {
    const sow = await this.sowModel
      .findById(id)
      .populate('property', 'name address landlord')
      .populate('unit', 'unitNumber type')
      .populate('assignedContractor', 'name category')
      .populate('assignedUser', 'firstName lastName email')
      .lean();

    if (!sow) {
      throw new NotFoundException('Scope of Work not found');
    }

    return { success: true, data: sow };
  }

  async findAllVisitRequests(queryDto: AdminQueryDto): Promise<AdminPaginatedResponse> {
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
        $lookup: {
          from: 'contractors',
          localField: 'contractor',
          foreignField: '_id',
          as: 'contractorInfo',
        },
      },
      {
        $addFields: {
          landlordName: { $arrayElemAt: ['$landlordInfo.name', 0] },
          propertyName: { $arrayElemAt: ['$propertyInfo.name', 0] },
          contractorName: { $arrayElemAt: ['$contractorInfo.name', 0] },
        },
      },
      {
        $project: {
          landlordInfo: 0,
          propertyInfo: 0,
          contractorInfo: 0,
        },
      },
      { $sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 } },
    ];

    const countPipeline = [{ $match: matchConditions }, { $count: 'total' }];
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];

    const [countResult, data] = await Promise.all([
      this.visitRequestModel.aggregate(countPipeline),
      this.visitRequestModel.aggregate(dataPipeline),
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

  async findVisitRequestById(id: string) {
    const visitRequest = await this.visitRequestModel
      .findById(id)
      .populate('landlord', 'name')
      .populate('property', 'name address')
      .populate('unit', 'unitNumber type')
      .populate('contractor', 'name category')
      .populate('tenant', 'name')
      .populate('requestedBy', 'firstName lastName email')
      .lean();

    if (!visitRequest) {
      throw new NotFoundException('Visit request not found');
    }

    return { success: true, data: visitRequest };
  }
}
