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
import {
  CreateVisitRequestDto,
  RespondVisitRequestDto,
  SuggestTimeDto,
  VisitRequestQueryDto,
} from '../dto';
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
      // Validate contact information only for unauthenticated marketplace requests
      if (!currentUser && (!createDto.fullName || !createDto.email || !createDto.phoneNumber)) {
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
        throw new BadRequestException(
          'You already have a pending visit request for this time slot',
        );
      }
    }

    // Check for time conflicts with existing visits
    await this.validateNoTimeConflicts(
      createDto.visitDate,
      createDto.startTime,
      createDto.endTime,
      landlordId,
      tenantId,
      contractorId,
    );

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
    const isAccepted = respondDto.response === VisitRequestResponse.ACCEPT;
    visitRequest.status = isAccepted ? VisitRequestStatus.APPROVED : VisitRequestStatus.DECLINED;
    visitRequest.responseMessage = respondDto.responseMessage;
    visitRequest.respondedBy = currentUser._id as mongoose.Types.ObjectId;
    visitRequest.respondedAt = new Date();

    const updatedRequest = await visitRequest.save();

    // Update all previous suggestions in the chain
    await this.updatePreviousSuggestions(visitRequest, isAccepted);

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

  private async updatePreviousSuggestions(
    visitRequest: VisitRequestDocument,
    isAccepted: boolean,
  ): Promise<void> {
    // If this request has no original request, it's the first one (no previous suggestions)
    if (!visitRequest.originalRequest && !visitRequest.previousSuggestion) {
      return;
    }

    // Get the original request ID
    const originalRequestId = visitRequest.originalRequest || visitRequest._id;

    // Find all previous suggestions in the chain (created before this one)
    const previousSuggestions = await this.visitRequestModel
      .find({
        $or: [{ _id: originalRequestId }, { originalRequest: originalRequestId }],
        _id: { $ne: visitRequest._id }, // Exclude the current request
        createdAt: { $lt: visitRequest.createdAt }, // Only earlier requests
        deleted: false,
      })
      .exec();

    // Update status of all previous suggestions
    const newStatus = isAccepted ? VisitRequestStatus.RESCHEDULED : VisitRequestStatus.DECLINED;

    await Promise.all(
      previousSuggestions.map(async (suggestion) => {
        suggestion.status = newStatus;
        return suggestion.save();
      }),
    );
  }

  private checkAccess(visitRequest: VisitRequestDocument, currentUser: UserDocument): void {
    const orgId = currentUser.organization_id?.toString();

    if (currentUser.user_type === UserType.CONTRACTOR) {
      const contractorId =
        typeof visitRequest.contractor === 'object' && visitRequest.contractor?._id
          ? visitRequest.contractor._id.toString()
          : visitRequest.contractor?.toString();
      if (contractorId !== orgId) {
        throw new ForbiddenException('You do not have access to this visit request');
      }
    } else if (currentUser.user_type === UserType.TENANT) {
      const tenantId =
        typeof visitRequest.tenant === 'object' && visitRequest.tenant?._id
          ? visitRequest.tenant._id.toString()
          : visitRequest.tenant?.toString();
      if (tenantId !== orgId) {
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
    let recipientRole: string;

    // For marketplace requests, always notify the landlord
    if (visitRequest.sourceType === VisitRequestSourceType.MARKETPLACE) {
      const User = this.visitRequestModel.db.model('User');
      const landlordUser = await User.findOne({ organization_id: visitRequest.landlord }).exec();
      if (landlordUser) {
        recipientUserId = landlordUser._id.toString();
        recipientRole = 'landlord';
      }
    } else if (visitRequest.targetType === VisitRequestTargetType.UNIT && visitRequest.tenant) {
      // For contractor requests to a unit, notify the tenant living there
      const Tenant = this.visitRequestModel.db.model('Tenant');
      const tenant = await Tenant.findById(visitRequest.tenant).exec();
      if (tenant) {
        const User = this.visitRequestModel.db.model('User');
        const tenantUser = await User.findOne({ organization_id: tenant._id }).exec();
        if (tenantUser) {
          recipientUserId = tenantUser._id.toString();
          recipientRole = 'tenant';
        }
      }
    } else {
      // For contractor requests to a property, notify the landlord
      const User = this.visitRequestModel.db.model('User');
      const landlordUser = await User.findOne({ organization_id: visitRequest.landlord }).exec();
      if (landlordUser) {
        recipientUserId = landlordUser._id.toString();
        recipientRole = 'landlord';
      }
    }

    if (recipientUserId) {
      await this.notificationsService.createNotification(
        recipientUserId,
        'New Visit Request',
        `${requesterName} has requested a visit on ${visitDateStr} (${visitRequest.startTime} - ${visitRequest.endTime})`,
        `/dashboard/${recipientRole}/visit-requests`,
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

    const User = this.visitRequestModel.db.model('User');

    // For marketplace requests, notify the tenant who made the request
    if (visitRequest.sourceType === VisitRequestSourceType.MARKETPLACE) {
      if (visitRequest.requestedBy) {
        await this.notificationsService.createNotification(
          visitRequest.requestedBy.toString(),
          `Visit Request ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
          `${responderName} has ${statusText} your visit request for ${visitDateStr}`,
          `/dashboard/tenant/visit-requests/${visitRequest._id}`,
        );
      }
    } else {
      // For contractor requests, notify the contractor
      const contractorUser = await User.findOne({
        organization_id: visitRequest.contractor,
      }).exec();

      if (contractorUser) {
        await this.notificationsService.createNotification(
          contractorUser._id.toString(),
          `Visit Request ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
          `${responderName} has ${statusText} your visit request for ${visitDateStr}`,
          `/dashboard/contractor/visit-requests`,
        );
      }
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

  async suggestTime(
    id: string,
    suggestDto: SuggestTimeDto,
    currentUser: UserDocument,
  ): Promise<VisitRequestDocument> {
    // 1. Get the current visit request
    const currentRequest = await this.visitRequestModel.findOne({ _id: id, deleted: false }).exec();

    if (!currentRequest) {
      throw new NotFoundException('Visit request not found');
    }

    // 2. Check permission - user must be involved in this visit request
    const canSuggest = this.canUserSuggestTime(currentRequest, currentUser);
    if (!canSuggest) {
      throw new ForbiddenException(
        'You do not have permission to suggest a time for this visit request',
      );
    }

    // 3. Validate status - can only suggest on PENDING or RESCHEDULED requests
    if (
      currentRequest.status !== VisitRequestStatus.PENDING &&
      currentRequest.status !== VisitRequestStatus.RESCHEDULED
    ) {
      throw new BadRequestException(
        'Can only suggest alternative times for pending or rescheduled visit requests',
      );
    }

    // 4. Check if there's already a pending suggestion from the current request
    const existingSuggestion = await this.visitRequestModel
      .findOne({
        previousSuggestion: currentRequest._id,
        status: VisitRequestStatus.PENDING,
        deleted: false,
      })
      .exec();

    if (existingSuggestion) {
      throw new BadRequestException(
        'There is already a pending suggestion for this visit request. Please wait for a response.',
      );
    }

    // 5. Validate availability slot if provided
    if (suggestDto.availabilitySlotId) {
      const availabilitySlot = await this.availabilityModel
        .findById(suggestDto.availabilitySlotId)
        .exec();
      if (!availabilitySlot) {
        throw new NotFoundException('Availability slot not found');
      }
    }

    // 6. Check for time conflicts with existing visits
    await this.validateNoTimeConflicts(
      suggestDto.visitDate,
      suggestDto.startTime,
      suggestDto.endTime,
      currentRequest.landlord,
      currentRequest.tenant,
      currentRequest.contractor,
      currentRequest._id as mongoose.Types.ObjectId, // Exclude current request from conflict check
    );

    // 7. Determine the original request (root of the chain)
    const originalRequestId = currentRequest.originalRequest || currentRequest._id;

    // 8. Create the new suggested visit request
    const newRequest = new this.visitRequestModel({
      // Copy core fields from current request
      landlord: currentRequest.landlord,
      contractor: currentRequest.contractor,
      requestedBy: currentRequest.requestedBy,
      sourceType: currentRequest.sourceType,
      ticket: currentRequest.ticket,
      scopeOfWork: currentRequest.scopeOfWork,
      targetType: currentRequest.targetType,
      property: currentRequest.property,
      unit: currentRequest.unit,
      tenant: currentRequest.tenant,

      // Copy contact information for marketplace requests
      fullName: currentRequest.fullName,
      email: currentRequest.email,
      phoneNumber: currentRequest.phoneNumber,

      // New suggestion data
      availabilitySlot: suggestDto.availabilitySlotId || currentRequest.availabilitySlot,
      visitDate: suggestDto.visitDate,
      startTime: suggestDto.startTime,
      endTime: suggestDto.endTime,
      rescheduleReason: suggestDto.rescheduleReason,

      // Tracking fields
      suggestedBy: currentUser._id,
      suggestedAt: new Date(),
      previousSuggestion: currentRequest._id,
      originalRequest: originalRequestId,

      // Status
      status: VisitRequestStatus.PENDING,
    });

    // 9. Update the current request
    currentRequest.status = VisitRequestStatus.AWAITING_RESCHEDULE;
    currentRequest.nextSuggestion = newRequest._id as mongoose.Types.ObjectId;

    // 10. Save both requests
    const [savedNewRequest] = await Promise.all([newRequest.save(), currentRequest.save()]);

    // 11. Send notifications
    await this.sendTimeSuggestionNotification(savedNewRequest, currentUser);

    return savedNewRequest;
  }

  async getSuggestionChain(id: string, currentUser: UserDocument): Promise<VisitRequest[]> {
    const visitRequest = await this.visitRequestModel
      .findOne({ _id: id, deleted: false })
      .populate('contractor')
      .populate('tenant')
      .exec();

    if (!visitRequest) {
      throw new NotFoundException('Visit request not found');
    }

    // Check access
    this.checkAccess(visitRequest, currentUser);

    // Get the original request ID
    const originalRequestId = visitRequest.originalRequest || visitRequest._id;

    // Get all requests in the chain
    const chain = await this.visitRequestModel
      .find({
        $or: [{ _id: originalRequestId }, { originalRequest: originalRequestId }],
        deleted: false,
      })
      .populate('suggestedBy', 'firstName lastName')
      .populate('respondedBy', 'firstName lastName')
      .sort({ createdAt: 1 })
      .exec();

    return chain;
  }

  private canUserSuggestTime(
    visitRequest: VisitRequestDocument,
    currentUser: UserDocument,
  ): boolean {
    const orgId = currentUser.organization_id?.toString();

    // Contractor can suggest
    if (
      currentUser.user_type === UserType.CONTRACTOR &&
      visitRequest.contractor?.toString() === orgId
    ) {
      return true;
    }

    // Tenant can suggest (for unit visits)
    if (currentUser.user_type === UserType.TENANT && visitRequest.tenant?.toString() === orgId) {
      return true;
    }

    // Landlord can suggest
    if (
      currentUser.user_type === UserType.LANDLORD &&
      visitRequest.landlord?.toString() === orgId
    ) {
      return true;
    }

    return false;
  }

  private async sendTimeSuggestionNotification(
    newRequest: VisitRequestDocument,
    suggester: UserDocument,
  ): Promise<void> {
    const suggesterName = `${suggester.firstName} ${suggester.lastName}`;
    const visitDateStr = newRequest.visitDate.toLocaleDateString();
    const timeSlot = `${newRequest.startTime} - ${newRequest.endTime}`;

    // Determine who to notify (the other party)
    let recipientUserId: string | undefined;
    let recipientRole: string;

    if (suggester.user_type === UserType.CONTRACTOR) {
      // Notify tenant or landlord
      if (newRequest.targetType === VisitRequestTargetType.UNIT && newRequest.tenant) {
        const User = this.visitRequestModel.db.model('User');
        const tenantUser = await User.findOne({
          organization_id: newRequest.tenant,
        }).exec();
        if (tenantUser) {
          recipientUserId = tenantUser._id.toString();
          recipientRole = 'tenant';
        }
      } else {
        const User = this.visitRequestModel.db.model('User');
        const landlordUser = await User.findOne({
          organization_id: newRequest.landlord,
        }).exec();
        if (landlordUser) {
          recipientUserId = landlordUser._id.toString();
          recipientRole = 'landlord';
        }
      }
    } else if (suggester.user_type === UserType.TENANT) {
      // Tenant suggested - notify landlord
      const User = this.visitRequestModel.db.model('User');
      const landlordUser = await User.findOne({
        organization_id: newRequest.landlord,
      }).exec();
      if (landlordUser) {
        recipientUserId = landlordUser._id.toString();
        recipientRole = 'landlord';
      }
    } else if (suggester.user_type === UserType.LANDLORD) {
      // Landlord suggested - notify tenant if exists, or the requester
      if (newRequest.targetType === VisitRequestTargetType.UNIT && newRequest.tenant) {
        const User = this.visitRequestModel.db.model('User');
        const tenantUser = await User.findOne({
          organization_id: newRequest.tenant,
        }).exec();
        if (tenantUser) {
          recipientUserId = tenantUser._id.toString();
          recipientRole = 'tenant';
        }
      } else if (newRequest.requestedBy) {
        // For authenticated marketplace requests, notify the requester
        recipientUserId = newRequest.requestedBy.toString();
        recipientRole = 'tenant'; // They might not be a tenant yet, but use tenant dashboard
      }
      // For unauthenticated marketplace requests with only contact info,
      // we can't send in-app notifications (no user account)
    } else {
      // Fallback: notify contractor if exists
      if (newRequest.contractor) {
        const User = this.visitRequestModel.db.model('User');
        const contractorUser = await User.findOne({
          organization_id: newRequest.contractor,
        }).exec();
        if (contractorUser) {
          recipientUserId = contractorUser._id.toString();
          recipientRole = 'contractor';
        }
      }
    }

    if (recipientUserId) {
      const message = newRequest.rescheduleReason
        ? `${suggesterName} suggested a new time for the visit: ${visitDateStr} (${timeSlot}). Reason: ${newRequest.rescheduleReason}`
        : `${suggesterName} suggested a new time for the visit: ${visitDateStr} (${timeSlot})`;

      await this.notificationsService.createNotification(
        recipientUserId,
        'New Time Suggested',
        message,
        `/dashboard/${recipientRole}/visit-requests/${newRequest._id}`,
      );
    }
  }

  /**
   * Validates that there are no time conflicts for a visit request.
   * Checks if landlord, tenant, or contractor already has a visit at the requested time.
   * @throws BadRequestException if a time conflict is detected
   */
  private async validateNoTimeConflicts(
    visitDate: Date,
    startTime: string,
    endTime: string,
    landlordId: mongoose.Types.ObjectId,
    tenantId?: mongoose.Types.ObjectId,
    contractorId?: mongoose.Types.ObjectId,
    excludeRequestId?: mongoose.Types.ObjectId,
  ): Promise<void> {
    // Build the query to find conflicting visits
    const query: any = {
      visitDate: visitDate,
      status: {
        $in: [
          VisitRequestStatus.PENDING,
          VisitRequestStatus.APPROVED,
          VisitRequestStatus.BOOKED,
          VisitRequestStatus.AWAITING_RESCHEDULE,
        ],
      },
      deleted: false,
      $or: [
        { landlord: landlordId },
        ...(tenantId ? [{ tenant: tenantId }] : []),
        ...(contractorId ? [{ contractor: contractorId }] : []),
      ],
      $expr: {
        $or: [
          // New visit starts during existing visit
          {
            $and: [{ $lte: ['$startTime', startTime] }, { $gt: ['$endTime', startTime] }],
          },
          // New visit ends during existing visit
          {
            $and: [{ $lt: ['$startTime', endTime] }, { $gte: ['$endTime', endTime] }],
          },
          // New visit completely contains existing visit
          {
            $and: [{ $gte: ['$startTime', startTime] }, { $lte: ['$endTime', endTime] }],
          },
          // Existing visit completely contains new visit
          {
            $and: [{ $lte: ['$startTime', startTime] }, { $gte: ['$endTime', endTime] }],
          },
        ],
      },
    };

    // Exclude current request if updating/rescheduling
    if (excludeRequestId) {
      query._id = { $ne: excludeRequestId };
    }

    const conflictingVisit = await this.visitRequestModel.findOne(query).exec();

    if (conflictingVisit) {
      // Determine who has the conflict
      let conflictWith = 'landlord';
      if (tenantId && conflictingVisit.tenant?.toString() === tenantId.toString()) {
        conflictWith = 'tenant';
      } else if (
        contractorId &&
        conflictingVisit.contractor?.toString() === contractorId.toString()
      ) {
        conflictWith = 'contractor';
      }

      // Format dates and times for error message
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      const existingTimeSlot = `${conflictingVisit.startTime} - ${conflictingVisit.endTime}`;
      const requestedTimeSlot = `${startTime} - ${endTime}`;

      throw new BadRequestException(
        `Time conflict detected: The ${conflictWith} already has a ${conflictingVisit.status.toLowerCase()} visit on ` +
          `${formatDate(conflictingVisit.visitDate)} (${existingTimeSlot}). ` +
          `This overlaps with the requested time ${formatDate(visitDate)} (${requestedTimeSlot}).`,
      );
    }
  }
}
