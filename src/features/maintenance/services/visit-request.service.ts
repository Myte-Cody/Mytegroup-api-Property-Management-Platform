import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { LeaseStatus } from '../../../common/enums/lease.enum';
import { UserType } from '../../../common/enums/user-type.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { createPaginatedResponse, PaginatedResponse } from '../../../common/utils/pagination.utils';
import { Availability } from '../../availability/schemas/availability.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { UserDocument } from '../../users/schemas/user.schema';
import { CreateVisitRequestDto, RespondVisitRequestDto, VisitRequestQueryDto } from '../dto';
import { VisitRequestResponse } from '../dto/respond-visit-request.dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';
import {
  VisitRequest,
  VisitRequestDocument,
  VisitRequestSourceType,
  VisitRequestStatus,
  VisitRequestTargetType,
} from '../schemas/visit-request.schema';

@Injectable()
export class VisitRequestService {
  constructor(
    @InjectModel(VisitRequest.name)
    private readonly visitRequestModel: AppModel<VisitRequest>,
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
    @InjectModel(ScopeOfWork.name)
    private readonly sowModel: AppModel<ScopeOfWork>,
    @InjectModel(Availability.name)
    private readonly availabilityModel: AppModel<Availability>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    createDto: CreateVisitRequestDto,
    currentUser?: UserDocument,
  ): Promise<VisitRequestDocument> {
    // For marketplace requests, no authentication is required
    // For other sources, only contractors can create visit requests
    if (createDto.sourceType !== VisitRequestSourceType.MARKETPLACE) {
      if (!currentUser || currentUser.user_type !== UserType.CONTRACTOR) {
        throw new ForbiddenException('Only contractors can create visit requests');
      }
    }

    const contractorId = currentUser?.organization_id;

    // Validate source type and get source data
    let property: any;
    let unit: any;
    let landlordId: mongoose.Types.ObjectId;
    let tenantId: mongoose.Types.ObjectId | undefined;
    let targetType: VisitRequestTargetType;
    let ticketId: mongoose.Types.ObjectId | undefined;
    let sowId: mongoose.Types.ObjectId | undefined;

    if (createDto.sourceType === VisitRequestSourceType.TICKET) {
      if (!createDto.ticketId) {
        throw new BadRequestException('Ticket ID is required for ticket-based visit requests');
      }

      const ticket = await this.ticketModel
        .findById(createDto.ticketId)
        .populate('property')
        .populate('unit')
        .exec();

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      // Verify contractor is assigned to this ticket
      if (ticket.assignedContractor?.toString() !== contractorId.toString()) {
        throw new ForbiddenException('You are not assigned to this ticket');
      }

      property = ticket.property;
      unit = ticket.unit;
      landlordId = ticket.landlord;
      ticketId = ticket._id as mongoose.Types.ObjectId;

      if (!property) {
        throw new BadRequestException('Ticket must have a property to create a visit request');
      }
    } else if (createDto.sourceType === VisitRequestSourceType.SCOPE_OF_WORK) {
      if (!createDto.scopeOfWorkId) {
        throw new BadRequestException('Scope of Work ID is required for SOW-based visit requests');
      }

      const sow = await this.sowModel
        .findById(createDto.scopeOfWorkId)
        .populate('property')
        .populate('unit')
        .exec();

      if (!sow) {
        throw new NotFoundException('Scope of Work not found');
      }

      // Verify contractor is assigned to this SOW
      if (sow.assignedContractor?.toString() !== contractorId.toString()) {
        throw new ForbiddenException('You are not assigned to this Scope of Work');
      }

      property = sow.property;
      unit = sow.unit;
      sowId = sow._id as mongoose.Types.ObjectId;

      if (!property && !unit) {
        throw new BadRequestException(
          'Scope of Work must have a property or unit to create a visit request',
        );
      }

      // If only unit is set, get the property from unit
      if (!property && unit) {
        const unitDoc = await this.unitModel.findById(unit).populate('property').exec();
        if (unitDoc) {
          property = unitDoc.property;
        }
      }

      // Get landlord from property
      const propertyDoc = await this.propertyModel.findById(property._id || property).exec();
      if (!propertyDoc) {
        throw new NotFoundException('Property not found');
      }
      landlordId = propertyDoc.landlord as mongoose.Types.ObjectId;
    } else if (createDto.sourceType === VisitRequestSourceType.MARKETPLACE) {
      // Validate contact information for marketplace requests
      if (!createDto.fullName || !createDto.email || !createDto.phoneNumber) {
        throw new BadRequestException(
          'Full name, email, and phone number are required for marketplace visit requests',
        );
      }

      // Get property and unit from availability slot
      const availabilitySlot = await this.availabilityModel
        .findById(createDto.availabilitySlotId)
        .populate('property')
        .populate('unit')
        .exec();

      if (!availabilitySlot) {
        throw new NotFoundException('Availability slot not found');
      }

      property = availabilitySlot.property;
      unit = availabilitySlot.unit || undefined;

      if (!property) {
        throw new BadRequestException('Availability slot must have a property');
      }

      // Get landlord from property
      const propertyDoc = await this.propertyModel.findById(property._id || property).exec();
      if (!propertyDoc) {
        throw new NotFoundException('Property not found');
      }
      landlordId = propertyDoc.landlord as mongoose.Types.ObjectId;
    } else {
      throw new BadRequestException('Invalid source type');
    }

    // Determine target type and tenant
    if (unit) {
      targetType = VisitRequestTargetType.UNIT;
      // Find active tenant for this unit
      const activeLease = await this.leaseModel
        .findOne({
          unit: unit._id || unit,
          status: LeaseStatus.ACTIVE,
        })
        .exec();

      if (activeLease) {
        tenantId = activeLease.tenant as mongoose.Types.ObjectId;
      }
    } else {
      targetType = VisitRequestTargetType.PROPERTY;
    }

    // Validate the availability slot
    const availabilitySlot = await this.availabilityModel
      .findById(createDto.availabilitySlotId)
      .exec();
    if (!availabilitySlot) {
      throw new NotFoundException('Availability slot not found');
    }

    // Check for duplicate pending request for same slot and date
    // Skip for marketplace requests since they don't have a contractor
    if (contractorId) {
      const existingRequest = await this.visitRequestModel
        .findOne({
          contractor: contractorId,
          availabilitySlot: createDto.availabilitySlotId,
          visitDate: createDto.visitDate,
          status: VisitRequestStatus.PENDING,
          deleted: false,
        })
        .exec();

      if (existingRequest) {
        throw new BadRequestException('You already have a pending visit request for this time slot');
      }
    }

    // Create the visit request
    const visitRequest = new this.visitRequestModel({
      landlord: landlordId,
      contractor: contractorId,
      requestedBy: currentUser?._id,
      sourceType: createDto.sourceType,
      ticket: ticketId,
      scopeOfWork: sowId,
      targetType,
      property: property._id || property,
      unit: unit?._id || unit,
      tenant: tenantId,
      availabilitySlot: createDto.availabilitySlotId,
      visitDate: createDto.visitDate,
      startTime: createDto.startTime,
      endTime: createDto.endTime,
      message: createDto.message,
      fullName: createDto.fullName,
      email: createDto.email,
      phoneNumber: createDto.phoneNumber,
      status: VisitRequestStatus.PENDING,
    });

    const savedRequest = await visitRequest.save();

    // Send notification to tenant or landlord
    await this.sendNewRequestNotification(savedRequest, currentUser);

    return savedRequest;
  }

  async findAll(
    queryDto: VisitRequestQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<VisitRequest>> {
    const {
      page = 1,
      limit = 10,
      status,
      sourceType,
      ticketId,
      scopeOfWorkId,
      propertyId,
      unitId,
      contractorId,
      tenantId,
      visitDateFrom,
      visitDateTo,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    const skip = (page - 1) * limit;
    const query: any = { deleted: false };

    // Role-based filtering
    if (currentUser.user_type === UserType.CONTRACTOR) {
      query.contractor = currentUser.organization_id;
    } else if (currentUser.user_type === UserType.TENANT) {
      query.tenant = currentUser.organization_id;
    } else if (currentUser.user_type === UserType.LANDLORD) {
      query.landlord = currentUser.organization_id;
    }

    // Apply filters
    if (status) query.status = status;
    if (sourceType) query.sourceType = sourceType;
    if (ticketId) query.ticket = new mongoose.Types.ObjectId(ticketId);
    if (scopeOfWorkId) query.scopeOfWork = new mongoose.Types.ObjectId(scopeOfWorkId);
    if (propertyId) query.property = new mongoose.Types.ObjectId(propertyId);
    if (unitId) query.unit = new mongoose.Types.ObjectId(unitId);
    if (contractorId) query.contractor = new mongoose.Types.ObjectId(contractorId);
    if (tenantId) query.tenant = new mongoose.Types.ObjectId(tenantId);

    if (visitDateFrom || visitDateTo) {
      query.visitDate = {};
      if (visitDateFrom) query.visitDate.$gte = visitDateFrom;
      if (visitDateTo) query.visitDate.$lte = visitDateTo;
    }

    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const [data, total] = await Promise.all([
      this.visitRequestModel
        .find(query)
        .populate('contractor', 'name')
        .populate('tenant', 'name')
        .populate('property', 'name address')
        .populate('unit', 'unitNumber')
        .populate('ticket', 'ticketNumber title')
        .populate('scopeOfWork', 'sowNumber title')
        .populate('requestedBy', 'firstName lastName email')
        .populate('respondedBy', 'firstName lastName email')
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .exec(),
      this.visitRequestModel.countDocuments(query).exec(),
    ]);

    return createPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument): Promise<VisitRequestDocument> {
    const visitRequest = await this.visitRequestModel
      .findOne({ _id: id, deleted: false })
      .populate('contractor', 'name')
      .populate('tenant', 'name')
      .populate('property', 'name address')
      .populate('unit', 'unitNumber')
      .populate('ticket', 'ticketNumber title')
      .populate('scopeOfWork', 'sowNumber title')
      .populate('requestedBy', 'firstName lastName email')
      .populate('respondedBy', 'firstName lastName email')
      .populate('availabilitySlot')
      .exec();

    if (!visitRequest) {
      throw new NotFoundException('Visit request not found');
    }

    // Check access based on role
    this.checkAccess(visitRequest, currentUser);

    return visitRequest;
  }

  async respond(
    id: string,
    respondDto: RespondVisitRequestDto,
    currentUser: UserDocument,
  ): Promise<VisitRequestDocument> {
    // Only tenants and landlords can respond to visit requests
    if (currentUser.user_type !== UserType.TENANT && currentUser.user_type !== UserType.LANDLORD) {
      throw new ForbiddenException('Only tenants and landlords can respond to visit requests');
    }

    const visitRequest = await this.visitRequestModel.findOne({ _id: id, deleted: false }).exec();

    if (!visitRequest) {
      throw new NotFoundException('Visit request not found');
    }

    // Check access
    if (currentUser.user_type === UserType.TENANT) {
      if (visitRequest.tenant?.toString() !== currentUser.organization_id?.toString()) {
        throw new ForbiddenException('You do not have permission to respond to this visit request');
      }
    } else if (currentUser.user_type === UserType.LANDLORD) {
      if (visitRequest.landlord?.toString() !== currentUser.organization_id?.toString()) {
        throw new ForbiddenException('You do not have permission to respond to this visit request');
      }
    }

    // Can only respond to pending requests
    if (visitRequest.status !== VisitRequestStatus.PENDING) {
      throw new BadRequestException('Can only respond to pending visit requests');
    }

    // Update status based on response
    visitRequest.status =
      respondDto.response === VisitRequestResponse.ACCEPT
        ? VisitRequestStatus.APPROVED
        : VisitRequestStatus.DECLINED;
    visitRequest.responseMessage = respondDto.responseMessage;
    visitRequest.respondedBy = currentUser._id as mongoose.Types.ObjectId;
    visitRequest.respondedAt = new Date();

    const updatedRequest = await visitRequest.save();

    // Send notification to contractor
    await this.sendResponseNotification(updatedRequest, currentUser);

    return updatedRequest;
  }

  async cancel(id: string, currentUser: UserDocument): Promise<VisitRequestDocument> {
    // Only contractors can cancel their own visit requests
    if (currentUser.user_type !== UserType.CONTRACTOR) {
      throw new ForbiddenException('Only contractors can cancel visit requests');
    }

    const visitRequest = await this.visitRequestModel.findOne({ _id: id, deleted: false }).exec();

    if (!visitRequest) {
      throw new NotFoundException('Visit request not found');
    }

    // Verify ownership
    if (visitRequest.contractor?.toString() !== currentUser.organization_id?.toString()) {
      throw new ForbiddenException('You can only cancel your own visit requests');
    }

    // Can only cancel pending requests
    if (visitRequest.status !== VisitRequestStatus.PENDING) {
      throw new BadRequestException('Can only cancel pending visit requests');
    }

    visitRequest.status = VisitRequestStatus.CANCELLED;

    const updatedRequest = await visitRequest.save();

    // Send notification to tenant or landlord
    await this.sendCancellationNotification(updatedRequest, currentUser);

    return updatedRequest;
  }

  async getByTicket(ticketId: string, currentUser: UserDocument): Promise<VisitRequest[]> {
    const query: any = {
      ticket: new mongoose.Types.ObjectId(ticketId),
      deleted: false,
    };

    // Role-based filtering
    if (currentUser.user_type === UserType.CONTRACTOR) {
      query.contractor = currentUser.organization_id;
    } else if (currentUser.user_type === UserType.TENANT) {
      query.tenant = currentUser.organization_id;
    } else if (currentUser.user_type === UserType.LANDLORD) {
      query.landlord = currentUser.organization_id;
    }

    return this.visitRequestModel
      .find(query)
      .populate('contractor', 'name')
      .populate('tenant', 'name')
      .populate('requestedBy', 'firstName lastName')
      .populate('respondedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getByScopeOfWork(sowId: string, currentUser: UserDocument): Promise<VisitRequest[]> {
    const query: any = {
      scopeOfWork: new mongoose.Types.ObjectId(sowId),
      deleted: false,
    };

    // Role-based filtering
    if (currentUser.user_type === UserType.CONTRACTOR) {
      query.contractor = currentUser.organization_id;
    } else if (currentUser.user_type === UserType.TENANT) {
      query.tenant = currentUser.organization_id;
    } else if (currentUser.user_type === UserType.LANDLORD) {
      query.landlord = currentUser.organization_id;
    }

    return this.visitRequestModel
      .find(query)
      .populate('contractor', 'name')
      .populate('tenant', 'name')
      .populate('requestedBy', 'firstName lastName')
      .populate('respondedBy', 'firstName lastName')
      .sort({ createdAt: -1 })
      .exec();
  }

  private checkAccess(visitRequest: VisitRequestDocument, currentUser: UserDocument): void {
    const orgId = currentUser.organization_id?.toString();

    if (currentUser.user_type === UserType.CONTRACTOR) {
      if (visitRequest.contractor?.toString() !== orgId) {
        throw new ForbiddenException('You do not have access to this visit request');
      }
    } else if (currentUser.user_type === UserType.TENANT) {
      if (visitRequest.tenant?.toString() !== orgId) {
        throw new ForbiddenException('You do not have access to this visit request');
      }
    } else if (currentUser.user_type === UserType.LANDLORD) {
      if (visitRequest.landlord?.toString() !== orgId) {
        throw new ForbiddenException('You do not have access to this visit request');
      }
    }
  }

  private async sendNewRequestNotification(
    visitRequest: VisitRequestDocument,
    requester?: UserDocument,
  ): Promise<void> {
    const requesterName = requester
      ? `${requester.firstName} ${requester.lastName}`
      : visitRequest.fullName || 'A prospective tenant';
    const visitDateStr = visitRequest.visitDate.toLocaleDateString();

    // Determine recipient
    let recipientUserId: string | undefined;

    if (visitRequest.targetType === VisitRequestTargetType.UNIT && visitRequest.tenant) {
      // Notify tenant
      const Tenant = this.visitRequestModel.db.model('Tenant');
      const tenant = await Tenant.findById(visitRequest.tenant).exec();
      if (tenant) {
        const User = this.visitRequestModel.db.model('User');
        const tenantUser = await User.findOne({ organization_id: tenant._id }).exec();
        if (tenantUser) {
          recipientUserId = tenantUser._id.toString();
        }
      }
    } else {
      // Notify landlord
      const User = this.visitRequestModel.db.model('User');
      const landlordUser = await User.findOne({ organization_id: visitRequest.landlord }).exec();
      if (landlordUser) {
        recipientUserId = landlordUser._id.toString();
      }
    }

    if (recipientUserId) {
      await this.notificationsService.createNotification(
        recipientUserId,
        'New Visit Request',
        `${requesterName} has requested a visit on ${visitDateStr} (${visitRequest.startTime} - ${visitRequest.endTime})`,
        `/dashboard/${visitRequest.tenant ? 'tenant' : 'landlord'}/visit-requests`,
      );
    }
  }

  private async sendResponseNotification(
    visitRequest: VisitRequestDocument,
    responder: UserDocument,
  ): Promise<void> {
    const responderName = `${responder.firstName} ${responder.lastName}`;
    const statusText =
      visitRequest.status === VisitRequestStatus.APPROVED ? 'accepted' : 'declined';
    const visitDateStr = visitRequest.visitDate.toLocaleDateString();

    // Find contractor user
    const User = this.visitRequestModel.db.model('User');
    const contractorUser = await User.findOne({ organization_id: visitRequest.contractor }).exec();

    if (contractorUser) {
      await this.notificationsService.createNotification(
        contractorUser._id.toString(),
        `Visit Request ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
        `${responderName} has ${statusText} your visit request for ${visitDateStr}`,
        `/dashboard/contractor/visit-requests`,
      );
    }
  }

  private async sendCancellationNotification(
    visitRequest: VisitRequestDocument,
    canceller: UserDocument,
  ): Promise<void> {
    const cancellerName = `${canceller.firstName} ${canceller.lastName}`;
    const visitDateStr = visitRequest.visitDate.toLocaleDateString();

    // Determine recipient
    let recipientUserId: string | undefined;

    if (visitRequest.targetType === VisitRequestTargetType.UNIT && visitRequest.tenant) {
      const User = this.visitRequestModel.db.model('User');
      const tenantUser = await User.findOne({ organization_id: visitRequest.tenant }).exec();
      if (tenantUser) {
        recipientUserId = tenantUser._id.toString();
      }
    } else {
      const User = this.visitRequestModel.db.model('User');
      const landlordUser = await User.findOne({ organization_id: visitRequest.landlord }).exec();
      if (landlordUser) {
        recipientUserId = landlordUser._id.toString();
      }
    }

    if (recipientUserId) {
      await this.notificationsService.createNotification(
        recipientUserId,
        'Visit Request Cancelled',
        `${cancellerName} has cancelled their visit request for ${visitDateStr}`,
        `/dashboard/${visitRequest.tenant ? 'tenant' : 'landlord'}/visit-requests`,
      );
    }
  }
}
