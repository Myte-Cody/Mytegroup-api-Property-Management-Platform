import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';
import { LeaseStatus } from '../../../common/enums/lease.enum';
import { InvoiceLinkedEntityType, TicketStatus } from '../../../common/enums/maintenance.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { Contractor } from '../../contractors/schema/contractor.schema';
import { MaintenanceEmailService } from '../../email/services/maintenance-email.service';
import { Lease } from '../../leases';
import { MediaService } from '../../media/services/media.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  AcceptTicketDto,
  AssignTicketDto,
  CreateTicketDto,
  RefuseTicketDto,
  TicketQueryDto,
  UpdateTicketDto,
} from '../dto';
import { MarkDoneTicketDto } from '../dto/mark-done-ticket.dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { TicketReferenceUtils } from '../utils/ticket-reference.utils';
import { SessionService } from './../../../common/services/session.service';
import { ScopeOfWork } from './../schemas/scope-of-work.schema';
import { InvoicesService } from './invoices.service';
import { ScopeOfWorkService } from './scope-of-work.service';
import { ThreadsService } from './threads.service';

@Injectable()
export class MaintenanceTicketsService {
  constructor(
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    @InjectModel(Contractor.name)
    private readonly contractorModel: AppModel<Contractor>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(ScopeOfWork.name)
    private readonly scopeOfWorkModel: AppModel<ScopeOfWork>,
    private readonly sessionService: SessionService,
    private readonly mediaService: MediaService,
    private readonly notificationsService: NotificationsService,
    private readonly maintenanceEmailService: MaintenanceEmailService,
    @Inject(forwardRef(() => ScopeOfWorkService))
    private readonly scopeOfWorkService: ScopeOfWorkService,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
  ) {}

  async findAllPaginated(ticketQueryDto: TicketQueryDto, currentUser: UserDocument) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      category,
      priority,
      propertyId,
      unitId,
      contractorId,
      startDate,
      endDate,
    } = ticketQueryDto;

    let baseQuery = this.ticketModel.find();

    if (currentUser.user_type === 'Contractor') {
      baseQuery = baseQuery.where({ assignedContractor: currentUser.organization_id });

      // Get all parent SOWs (SOWs with parentSow null and have at least one sub-SOW)
      const parentSows = await this.scopeOfWorkModel.find({ parentSow: null }).select('_id').exec();

      const parentSowIds: Types.ObjectId[] = [];
      for (const sow of parentSows) {
        const hasSubSows = await this.scopeOfWorkModel
          .findOne({ parentSow: sow._id })
          .select('_id')
          .exec();
        if (hasSubSows) {
          parentSowIds.push(sow._id as Types.ObjectId);
        }
      }

      // Filter tickets: no scopeOfWork OR scopeOfWork is a parent SOW
      baseQuery = baseQuery.where({
        $or: [{ scopeOfWork: null }, { scopeOfWork: { $in: parentSowIds } }],
      });
    }

    // Handle tenant filtering
    if (currentUser.user_type === 'Tenant') {
      // Find all active leases for this tenant
      const activeLeases = await this.leaseModel
        .find({
          tenant: currentUser.organization_id,
          status: LeaseStatus.ACTIVE,
        })
        .populate('unit', 'property')
        .exec();

      // Extract property and unit IDs from active leases
      const propertyIds = activeLeases.map((lease) => {
        const leaseUnit = lease.unit as any;
        return leaseUnit.property;
      });
      const unitIds = activeLeases.map((lease) => lease.unit);

      // Filter tickets: created by tenant users OR associated with their active lease properties/units
      const filterConditions: any[] = [];

      // Add conditions for tickets associated with properties/units from active leases
      if (propertyIds.length > 0) {
        filterConditions.push({ property: { $in: propertyIds }, unit: null });
      }

      if (unitIds.length > 0) {
        filterConditions.push({ unit: { $in: unitIds } });
      }

      // Only apply filter if we have at least one condition
      if (filterConditions.length > 0) {
        baseQuery = baseQuery.where({ $or: filterConditions });
      } else {
        // No tickets match - return empty result set
        baseQuery = baseQuery.where({ _id: null });
      }
    }

    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { ticketNumber: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (category) {
      baseQuery = baseQuery.where({ category });
    }

    if (priority) {
      baseQuery = baseQuery.where({ priority });
    }

    if (propertyId) {
      baseQuery = baseQuery.where({ property: propertyId });
    }

    if (unitId) {
      baseQuery = baseQuery.where({ unit: unitId });
    }

    if (contractorId) {
      baseQuery = baseQuery.where({ assignedContractor: contractorId });
    }

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      baseQuery = baseQuery.where({ createdAt: dateFilter });
    }

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [tickets, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('property', 'name address')
        .populate('unit', 'unitNumber type')
        .populate('assignedContractor', 'name')
        .populate('requestedBy', 'username email')
        .populate('assignedBy', 'username email')
        .populate('assignedUser', 'username email firstName lastName')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    const ticketsWithMedia = await Promise.all(
      tickets.map(async (ticket) => {
        const media = await this.mediaService.getMediaForEntity(
          'MaintenanceTicket',
          ticket._id.toString(),
          currentUser,
          undefined,
          {},
        );
        return {
          ...ticket.toObject(),
          media,
        };
      }),
    );

    return createPaginatedResponse(ticketsWithMedia, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument): Promise<any> {
    let query = this.ticketModel.findById(id);

    if (currentUser.user_type === 'Contractor') {
      query = query.where({ assignedContractor: currentUser.organization_id });
    }

    const ticket = await query
      .populate('property', 'name address')
      .populate('unit', 'unitNumber type')
      .populate('assignedContractor', 'name')
      .populate('requestedBy', 'username email')
      .populate('assignedBy', 'username email')
      .populate('assignedUser', 'username email firstName lastName')
      .exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    const media = await this.mediaService.getMediaForEntity(
      'MaintenanceTicket',
      ticket._id.toString(),
      currentUser,
      undefined,
      {},
    );

    let scopeOfWork = null;
    if (ticket.scopeOfWork) {
      scopeOfWork = await this.scopeOfWorkModel.findById(ticket.scopeOfWork.toString()).exec();
      scopeOfWork = {
        ...scopeOfWork.toObject(),
        subSows: await this.scopeOfWorkModel
          .find({ parentSow: ticket.scopeOfWork.toString() })
          .exec(),
      };
    }

    return {
      ...ticket.toObject(),
      scopeOfWork,
      media,
    };
  }

  async create(createTicketDto: CreateTicketDto, currentUser: UserDocument): Promise<any> {
    return this.sessionService.withSession(async (session: ClientSession | null) => {
      await this.validateTicketCreation(createTicketDto, currentUser, session);

      const ticketNumber = await TicketReferenceUtils.generateUniqueTicketNumber(this.ticketModel);

      const newTicket = new this.ticketModel({
        ...createTicketDto,
        requestedBy: currentUser._id,
        ticketNumber,
        requestDate: new Date(),
      });

      const ticket = await newTicket.save({ session });

      // Create thread for the ticket
      await this.createTicketThread(ticket, currentUser, session);

      // Send notification to landlord if ticket was created by tenant
      if (currentUser.user_type === 'Tenant') {
        await this.notifyLandlordOfNewTicket(ticket, currentUser, session);
      }

      if (createTicketDto.media_files && createTicketDto.media_files.length > 0) {
        const uploadPromises = createTicketDto.media_files.map(async (file) => {
          return this.mediaService.upload(
            file,
            ticket,
            currentUser,
            'ticket_images',
            undefined,
            'MaintenanceTicket',
            session,
          );
        });

        const uploadedMedia = await Promise.all(uploadPromises);

        return {
          success: true,
          data: {
            ticket,
            media: uploadedMedia,
          },
          message: `Ticket created successfully with ${uploadedMedia.length} media file(s)`,
        };
      }

      return {
        success: true,
        data: { ticket },
        message: 'Ticket created successfully',
      };
    });
  }

  async update(
    id: string,
    updateTicketDto: UpdateTicketDto,
    currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      if (!updateTicketDto || Object.keys(updateTicketDto).length === 0) {
        throw new BadRequestException('Update data cannot be empty');
      }

      const existingTicket = await this.ticketModel.findById(id, null, { session }).exec();

      if (!existingTicket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      this.validateUpdatePermissions(existingTicket, currentUser, updateTicketDto);

      const statusChanged =
        updateTicketDto.status && updateTicketDto.status !== existingTicket.status;
      const newStatus = updateTicketDto.status;

      if (statusChanged) {
        await this.handleStatusChange(existingTicket, newStatus);
      }

      Object.assign(existingTicket, updateTicketDto);
      const savedTicket = await existingTicket.save({ session });

      // Send notification to landlord if ticket was updated by tenant
      if (currentUser.user_type === 'Tenant') {
        await this.notifyLandlordOfTicketUpdate(savedTicket, currentUser, session);
      }

      // Send notification to tenant when ticket status changes to IN_REVIEW
      if (
        statusChanged &&
        newStatus === TicketStatus.IN_REVIEW &&
        currentUser.user_type === 'Landlord'
      ) {
        await this.notifyTenantOfTicketReview(savedTicket, session);
      }

      // If status changed and ticket has a scope of work, check if SOW status should be updated
      if (statusChanged && existingTicket.scopeOfWork) {
        await this.updateSowStatusOnTicketChange(existingTicket.scopeOfWork, newStatus, session);
      }

      return savedTicket;
    });
  }

  async assignTicket(
    id: string,
    assignDto: AssignTicketDto,
    currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      if (currentUser.user_type !== 'Landlord') {
        throw new ForbiddenException('Only landlords can assign tickets');
      }

      const ticket = await this.ticketModel.findById(id).exec();

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      const contractor = await this.contractorModel.findById(assignDto.contractorId).exec();

      if (!contractor) {
        throw new NotFoundException('Contractor not found');
      }

      // Update ticket
      ticket.assignedContractor = new Types.ObjectId(assignDto.contractorId);
      ticket.assignedBy = currentUser._id as Types.ObjectId;
      ticket.assignedDate = new Date();
      ticket.status = TicketStatus.ASSIGNED;

      const savedTicket = await ticket.save();

      // Notify tenant that contractor has been assigned
      await this.notifyTenantOfContractorAssignment(savedTicket, session);

      if (ticket.scopeOfWork) {
        await this.updateSowStatusOnTicketChange(
          ticket.scopeOfWork,
          TicketStatus.ASSIGNED,
          session,
        );
      }
      return savedTicket;
    });
  }

  async acceptTicket(
    id: string,
    acceptDto: AcceptTicketDto,
    _currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const ticket = await this.ticketModel.findById(id).exec();

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      // Verify the user exists
      const user = await this.userModel.findById(acceptDto.userId).exec();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Update ticket
      ticket.assignedUser = new Types.ObjectId(acceptDto.userId);
      ticket.status = TicketStatus.IN_PROGRESS;

      const savedTicket = await ticket.save();

      // Notify tenant that work has started
      await this.notifyTenantOfWorkStarted(savedTicket, session);

      // Add contractor to the thread
      if (ticket.assignedContractor) {
        try {
          await this.threadsService.addContractorToTicketThread(
            ticket._id as Types.ObjectId,
            ticket.assignedContractor.toString(),
          );
        } catch (error) {
          // Log error but don't fail ticket acceptance
          console.error('Failed to add contractor to thread:', error);
        }
      }

      if (ticket.scopeOfWork) {
        await this.updateSowStatusOnTicketChange(
          ticket.scopeOfWork,
          TicketStatus.IN_PROGRESS,
          session,
        );
      }

      return savedTicket;
    });
  }

  async refuseTicket(
    id: string,
    refuseDto: RefuseTicketDto,
    _currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const ticket = await this.ticketModel.findById(id).exec();

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      // Update ticket status to OPEN
      ticket.status = TicketStatus.OPEN;
      ticket.assignedContractor = null;
      ticket.assignedDate = null;
      if (refuseDto.refuseReason) {
        ticket.refuseReason = refuseDto.refuseReason;
      }

      const savedTicket = await ticket.save();
      if (ticket.scopeOfWork) {
        await this.updateSowStatusOnTicketChange(ticket.scopeOfWork, TicketStatus.OPEN, session);
      }
      return savedTicket;
    });
  }

  async markAsDone(id: string, markDoneDto: MarkDoneTicketDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const ticket = await this.ticketModel.findById(id).exec();
      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      // Update ticket status to DONE
      ticket.status = TicketStatus.DONE;
      ticket.completedDate = new Date();

      const savedTicket = await ticket.save();

      // Send notification to landlord that ticket is marked done by contractor
      if (currentUser.user_type === 'Contractor' && ticket.assignedContractor) {
        const contractor = await this.contractorModel.findById(ticket.assignedContractor).exec();
        await this.notifyLandlordOfTicketCompletion(savedTicket, contractor);
        // Also notify tenant that work is done
        await this.notifyTenantOfWorkDone(savedTicket, session);
      }

      // Check if the ticket has a scope of work
      if (ticket.scopeOfWork) {
        // Update SOW status if all tickets are done
        await this.updateSowStatusOnTicketChange(ticket.scopeOfWork, TicketStatus.DONE, session);
      }

      if (markDoneDto.media_files && markDoneDto.media_files.length > 0) {
        const uploadPromises = markDoneDto.media_files.map(async (file) => {
          return this.mediaService.upload(
            file,
            ticket,
            currentUser,
            'work_proof',
            undefined,
            'MaintenanceTicket',
            session,
          );
        });

        const uploadedMedia = await Promise.all(uploadPromises);

        return {
          ...savedTicket,
          workProofMedia: uploadedMedia,
        };
      }

      return savedTicket;
    });
  }

  async closeTicket(id: string, _currentUser: UserDocument): Promise<MaintenanceTicket> {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const ticket = await this.ticketModel.findById(id, null, { session }).exec();

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      // Update ticket status to CLOSED
      ticket.status = TicketStatus.CLOSED;

      const savedTicket = await ticket.save({ session });

      // Notify tenant that ticket has been completed
      await this.notifyTenantOfTicketClosed(savedTicket, session);

      // Auto-confirm all pending invoices for this ticket
      await this.invoicesService.confirmInvoicesByLinkedEntity(
        ticket._id as Types.ObjectId,
        InvoiceLinkedEntityType.TICKET,
        session,
      );

      return savedTicket;
    });
  }

  async reopenTicket(id: string, _currentUser: UserDocument): Promise<MaintenanceTicket> {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const ticket = await this.ticketModel
        .findById(id, null, { session })
        .populate('scopeOfWork')
        .exec();
      let scopeOfWork: ScopeOfWork;

      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${id} not found`);
      }

      // Check if ticket has a scope of work and if that SOW is closed
      if (ticket.scopeOfWork) {
        scopeOfWork = ticket.scopeOfWork as unknown as ScopeOfWork;
        if (scopeOfWork.status === TicketStatus.CLOSED) {
          throw new BadRequestException(
            'Cannot reopen ticket because its associated Scope of Work is closed',
          );
        }
      }

      // Determine the new status based on current status
      if (ticket.status === TicketStatus.DONE) {
        ticket.status = TicketStatus.IN_PROGRESS;
      } else if (ticket.status === TicketStatus.CLOSED) {
        ticket.status = TicketStatus.OPEN;
        ticket.assignedContractor = null;
        ticket.assignedDate = null;
        ticket.assignedUser = null;
        ticket.assignedBy = null;
      } else {
        throw new BadRequestException('Only tickets with DONE or CLOSED status can be reopened');
      }
      ticket.completedDate = null;

      const savedTicket = await ticket.save({ session });

      // Notify tenant that ticket has been reopened
      await this.notifyTenantOfTicketReopened(savedTicket, session);

      // Send notification to landlord that work was rejected (ticket reopened)
      if (ticket.assignedContractor) {
        const contractor = await this.contractorModel.findById(ticket.assignedContractor).exec();
        await this.notifyLandlordOfWorkRejection(savedTicket, contractor);
      }

      if (scopeOfWork) {
        await this.reopenSowsRecursively(scopeOfWork._id as Types.ObjectId, session);
      }

      return savedTicket;
    });
  }

  async remove(id: string, currentUser: UserDocument): Promise<{ message: string }> {
    // Find ticket
    const ticket = await this.ticketModel.findById(id).exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // Only allow deletion of OPEN tickets
    if (ticket.status !== TicketStatus.OPEN) {
      throw new BadRequestException('Only open tickets can be deleted');
    }

    // Only ticket creator or landlord can delete
    if (
      currentUser.user_type === 'Tenant' &&
      ticket.requestedBy.toString() !== currentUser._id.toString()
    ) {
      throw new ForbiddenException('You can only delete your own tickets');
    }

    await this.ticketModel.findByIdAndDelete(id);
    return { message: 'Ticket deleted successfully' };
  }

  // Helper Methods

  private async validateTicketCreation(
    createTicketDto: CreateTicketDto,
    currentUser: UserDocument,
    session: ClientSession | null,
  ) {
    const property = await this.propertyModel
      .findById(createTicketDto.property, null, { session })
      .exec();
    if (!property) {
      throw new NotFoundException('Property not found');
    }
    if (createTicketDto.unit) {
      const unit = await this.unitModel.findById(createTicketDto.unit, null, { session }).exec();
      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      if (unit.property.toString() !== createTicketDto.property) {
        throw new BadRequestException('Unit does not belong to the specified property');
      }
    }

    if (currentUser.user_type === 'Tenant') {
      // Get the tenant record associated with this user
      const tenant = await this.tenantModel
        .findOne({ _id: currentUser.organization_id }, null, { session })
        .exec();

      if (!tenant) {
        throw new ForbiddenException('Tenant profile not found');
      }

      // Check if tenant has an active lease for this unit
      if (createTicketDto.unit) {
        const activeLease = await this.leaseModel
          .findOne(
            {
              tenant: tenant._id,
              unit: createTicketDto.unit,
              status: LeaseStatus.ACTIVE,
            },
            null,
            { session },
          )
          .exec();

        if (!activeLease) {
          throw new ForbiddenException(
            'You do not have an active lease for this unit. Only tenants with active leases can create maintenance tickets for specific units.',
          );
        }
      } else {
        // If no unit is specified, verify tenant has at least one active lease for the property
        const activeLeaseForProperty = await this.leaseModel
          .findOne(
            {
              tenant: tenant._id,
              status: LeaseStatus.ACTIVE,
            },
            null,
            { session },
          )
          .populate('unit', 'property')
          .exec();

        if (!activeLeaseForProperty) {
          throw new ForbiddenException(
            'You do not have any active leases. Only tenants with active leases can create maintenance tickets.',
          );
        }

        // Verify the lease is for a unit in the specified property
        const leaseUnit = activeLeaseForProperty.unit as any;
        if (leaseUnit.property.toString() !== createTicketDto.property) {
          throw new ForbiddenException(
            'You do not have an active lease for this property. You can only create maintenance tickets for properties where you have an active lease.',
          );
        }
      }
    }
  }

  private validateUpdatePermissions(
    ticket: MaintenanceTicket,
    currentUser: UserDocument,
    updateDto: UpdateTicketDto,
  ) {
    if (currentUser.user_type === 'Tenant') {
      if (ticket.requestedBy.toString() !== currentUser._id.toString()) {
        throw new ForbiddenException('You can only update your own tickets');
      }

      const allowedFields = ['title', 'description', 'priority', 'notes', 'images'];
      const updateFields = Object.keys(updateDto);
      const invalidFields = updateFields.filter((field) => !allowedFields.includes(field));

      if (invalidFields.length > 0) {
        throw new ForbiddenException(`Tenants cannot update fields: ${invalidFields.join(', ')}`);
      }
    }

    if (currentUser.user_type === 'Contractor') {
      if (
        !ticket.assignedContractor ||
        ticket.assignedContractor.toString() !== currentUser._id.toString()
      ) {
        throw new ForbiddenException('You can only update tickets assigned to you');
      }

      const allowedFields = ['status', 'notes', 'completedDate'];
      const updateFields = Object.keys(updateDto);
      const invalidFields = updateFields.filter((field) => !allowedFields.includes(field));

      if (invalidFields.length > 0) {
        throw new ForbiddenException(
          `Contractors cannot update fields: ${invalidFields.join(', ')}`,
        );
      }
    }
  }

  private async handleStatusChange(ticket: MaintenanceTicket, newStatus: TicketStatus) {
    // current flow
    //  OPEN → IN_REVIEW or CLOSED
    //  IN_REVIEW → ASSIGNED or CLOSED
    //  ASSIGNED → IN_PROGRESS or CLOSED
    //  IN_PROGRESS → DONE only
    //  DONE → CLOSED only
    //  CLOSED → terminal
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.OPEN]: [TicketStatus.IN_REVIEW, TicketStatus.CLOSED],
      [TicketStatus.IN_REVIEW]: [TicketStatus.ASSIGNED, TicketStatus.CLOSED],
      [TicketStatus.ASSIGNED]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
      [TicketStatus.IN_PROGRESS]: [TicketStatus.DONE],
      [TicketStatus.DONE]: [TicketStatus.CLOSED],
      [TicketStatus.CLOSED]: [], // Terminal state
    };

    if (!validTransitions[ticket.status].includes(newStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${ticket.status} to ${newStatus}`,
      );
    }

    if (newStatus === TicketStatus.DONE && !ticket.completedDate) {
      ticket.completedDate = new Date();
    }
  }

  private async updateSowStatusOnTicketChange(
    sowId: Types.ObjectId,
    newStatus: TicketStatus,
    session: ClientSession | null = null,
  ): Promise<void> {
    const sow = await this.scopeOfWorkModel.findById(sowId, null, { session }).exec();

    if (!sow) {
      return;
    }

    // Get all tickets for this SOW (direct tickets only, not from sub-SOWs)
    const tickets = await this.scopeOfWorkService.getAllTicketsRecursively(sowId, session);

    if (tickets.length === 0) {
      return;
    }

    // Check if all tickets have the same status as the new status
    const allTicketsHaveSameStatus = tickets.every((ticket) => ticket.status === newStatus);

    // Update SOW status if all tickets have the same status
    if (allTicketsHaveSameStatus && sow.status !== newStatus) {
      sow.status = newStatus;
      if (newStatus === TicketStatus.DONE) {
        sow.completedDate = new Date();
      }
      await sow.save({ session });

      // Update parent SOWs recursively using the ScopeOfWorkService method
      if (sow.parentSow) {
        await this.scopeOfWorkService.updateParentSowsStatus(sow.parentSow, newStatus, session);
      }
    }
  }

  private async reopenSowsRecursively(sowId: Types.ObjectId, session: ClientSession | null = null) {
    const sow = await this.scopeOfWorkModel.findById(sowId, null, { session }).exec();

    if (!sow) {
      return;
    }

    const wasClosedBefore = sow.status === TicketStatus.CLOSED;

    sow.status = TicketStatus.IN_PROGRESS;
    sow.completedDate = null;
    await sow.save({ session });

    // Notify tenants that thread is reopened if SOW was closed
    if (wasClosedBefore) {
      await this.threadsService.notifyTenantsOfThreadReopened(sowId);
    }

    if (sow.parentSow) {
      await this.reopenSowsRecursively(sow.parentSow, session);
    }
  }

  /**
   * Create thread automatically when a ticket is created
   */
  private async createTicketThread(
    ticket: MaintenanceTicket,
    currentUser: UserDocument,
    session: ClientSession | null,
  ): Promise<void> {
    try {
      // Determine landlord and tenant IDs
      let landlordId: string;
      let tenantId: string;

      if (currentUser.user_type === 'Landlord') {
        // Landlord created the ticket
        landlordId = currentUser.organization_id.toString();

        // Get tenant from active lease
        const lease = await this.leaseModel
          .findOne(
            {
              unit: ticket.unit,
              status: LeaseStatus.ACTIVE,
            },
            null,
            { session },
          )
          .exec();

        if (!lease) {
          // No active lease, can't create thread without tenant
          return;
        }

        tenantId = lease.tenant.toString();
      } else if (currentUser.user_type === 'Tenant') {
        // Tenant created the ticket
        tenantId = currentUser.organization_id.toString();

        // Get landlord - we need to find who owns the property
        // For now, we'll look for a landlord user associated with this property
        // This is a limitation - ideally property should have a landlord reference
        const landlordUser = await this.userModel
          .findOne({ user_type: 'Landlord' }, null, { session })
          .exec();

        if (!landlordUser) {
          // No landlord found, can't create thread
          return;
        }

        landlordId = landlordUser.organization_id.toString();
      } else {
        // Other user types shouldn't be creating tickets
        return;
      }

      // Create the thread
      await this.threadsService.createThreadForTicket(ticket as any, landlordId, tenantId);
    } catch (error) {
      // Log error but don't fail ticket creation
      console.error('Failed to create thread for ticket:', error);
    }
  }

  /**
   * Notify landlord when a new ticket is created by tenant
   */
  private async notifyLandlordOfNewTicket(
    ticket: MaintenanceTicket,
    currentUser: UserDocument,
    session: ClientSession | null,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel
        .findOne({ user_type: 'Landlord' }, null, { session })
        .exec();

      if (!landlordUser) {
        return;
      }

      const tenantName =
        currentUser.firstName && currentUser.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser.username;

      // Send in-app notification
      await this.notificationsService.createNotification(
        landlordUser._id.toString(),
        'New Maintenance Request',
        `🔧 New maintenance request ${ticket.title} from ${tenantName}.`,
      );

      // Get property and unit information
      const property = await this.propertyModel.findById(ticket.property, null, { session }).exec();

      let unitIdentifier: string | undefined;
      if (ticket.unit) {
        const unit = await this.unitModel.findById(ticket.unit, null, { session }).exec();
        unitIdentifier = unit?.unitNumber;
      }

      const landlordName =
        landlordUser.firstName && landlordUser.lastName
          ? `${landlordUser.firstName} ${landlordUser.lastName}`
          : landlordUser.username;

      // Send email notification
      await this.maintenanceEmailService.sendTicketCreatedEmail(
        {
          recipientName: landlordName,
          recipientEmail: landlordUser.email,
          tenantName,
          ticketNumber: ticket.ticketNumber,
          ticketTitle: ticket.title,
          priority: ticket.priority,
          category: ticket.category,
          propertyName: property?.name || 'Unknown Property',
          unitIdentifier,
          description: ticket.description,
          createdAt: ticket.createdAt || new Date(),
        },
        { queue: true },
      );
    } catch (error) {
      console.error('Failed to notify landlord of new ticket:', error);
    }
  }

  /**
   * Notify landlord when a ticket is updated by tenant
   */
  private async notifyLandlordOfTicketUpdate(
    ticket: MaintenanceTicket,
    currentUser: UserDocument,
    session: ClientSession | null,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel
        .findOne({ user_type: 'Landlord' }, null, { session })
        .exec();

      if (!landlordUser) {
        return;
      }

      const tenantName =
        currentUser.firstName && currentUser.lastName
          ? `${currentUser.firstName} ${currentUser.lastName}`
          : currentUser.username;

      await this.notificationsService.createNotification(
        landlordUser._id.toString(),
        'Ticket Updated',
        `Ticket ${ticket.title} was updated by ${tenantName}.`,
      );
    } catch (error) {
      console.error('Failed to notify landlord of ticket update:', error);
    }
  }

  /**
   * Notify landlord when a ticket is marked done by contractor
   */
  private async notifyLandlordOfTicketCompletion(
    ticket: MaintenanceTicket,
    contractor: any,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel.findOne({ user_type: 'Landlord' }).exec();

      if (!landlordUser) {
        return;
      }

      const contractorName = contractor?.name || 'Contractor';

      // Send in-app notification
      await this.notificationsService.createNotification(
        landlordUser._id.toString(),
        'Ticket Completed',
        `Ticket ${ticket.title} was marked done by ${contractorName}.`,
      );

      // Get property and unit information
      const property = await this.propertyModel.findById(ticket.property).exec();

      let unitIdentifier: string | undefined;
      if (ticket.unit) {
        const unit = await this.unitModel.findById(ticket.unit).exec();
        unitIdentifier = unit?.unitNumber;
      }

      const landlordName =
        landlordUser.firstName && landlordUser.lastName
          ? `${landlordUser.firstName} ${landlordUser.lastName}`
          : landlordUser.username;

      // Send email notification
      await this.maintenanceEmailService.sendTicketCompletedEmail(
        {
          recipientName: landlordName,
          recipientEmail: landlordUser.email,
          contractorName,
          ticketNumber: ticket.ticketNumber,
          ticketTitle: ticket.title,
          category: ticket.category,
          propertyName: property?.name || 'Unknown Property',
          unitIdentifier,
          completedAt: new Date(),
          cost: ticket.cost,
          completionNotes: ticket.completionNotes,
        },
        { queue: true },
      );
    } catch (error) {
      console.error('Failed to notify landlord of ticket completion:', error);
    }
  }

  /**
   * Notify landlord when work is rejected (ticket reopened)
   */
  private async notifyLandlordOfWorkRejection(
    ticket: MaintenanceTicket,
    contractor: any,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel.findOne({ user_type: 'Landlord' }).exec();

      if (!landlordUser) {
        return;
      }

      const contractorName = contractor?.name || 'Contractor';

      await this.notificationsService.createNotification(
        landlordUser._id.toString(),
        'Work Rejected',
        `Contractor ${contractorName} rejected work for ${ticket.title}.`,
      );
    } catch (error) {
      console.error('Failed to notify landlord of work rejection:', error);
    }
  }

  /**
   * Notify tenant when ticket is reviewed by landlord
   */
  private async notifyTenantOfTicketReview(
    ticket: MaintenanceTicket,
    session: ClientSession | null = null,
  ): Promise<void> {
    try {
      const requestedByUser = await this.userModel
        .findById(ticket.requestedBy, null, { session })
        .exec();

      if (!requestedByUser || requestedByUser.user_type !== 'Tenant') {
        return;
      }

      await this.notificationsService.createNotification(
        requestedByUser._id.toString(),
        'Ticket Under Review',
        `👀 Your maintenance request "${ticket.title}" is now under review.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of ticket review:', error);
    }
  }

  /**
   * Notify tenant when ticket is assigned to contractor
   */
  private async notifyTenantOfContractorAssignment(
    ticket: MaintenanceTicket,
    session: ClientSession | null = null,
  ): Promise<void> {
    try {
      const requestedByUser = await this.userModel
        .findById(ticket.requestedBy, null, { session })
        .exec();

      if (!requestedByUser || requestedByUser.user_type !== 'Tenant') {
        return;
      }

      const contractor = ticket.assignedContractor
        ? await this.contractorModel.findById(ticket.assignedContractor, null, { session }).exec()
        : null;

      const contractorName = contractor?.name || 'a contractor';

      await this.notificationsService.createNotification(
        requestedByUser._id.toString(),
        'Contractor Assigned',
        `👷 Your maintenance request "${ticket.title}" has been assigned to ${contractorName}.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of contractor assignment:', error);
    }
  }

  /**
   * Notify tenant when work starts on their ticket
   */
  private async notifyTenantOfWorkStarted(
    ticket: MaintenanceTicket,
    session: ClientSession | null = null,
  ): Promise<void> {
    try {
      const requestedByUser = await this.userModel
        .findById(ticket.requestedBy, null, { session })
        .exec();

      if (!requestedByUser || requestedByUser.user_type !== 'Tenant') {
        return;
      }

      await this.notificationsService.createNotification(
        requestedByUser._id.toString(),
        'Work Started',
        `🔧 Work on "${ticket.title}" has started.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of work started:', error);
    }
  }

  /**
   * Notify tenant when work is completed on their ticket
   */
  private async notifyTenantOfWorkDone(
    ticket: MaintenanceTicket,
    session: ClientSession | null = null,
  ): Promise<void> {
    try {
      const requestedByUser = await this.userModel
        .findById(ticket.requestedBy, null, { session })
        .exec();

      if (!requestedByUser || requestedByUser.user_type !== 'Tenant') {
        return;
      }

      await this.notificationsService.createNotification(
        requestedByUser._id.toString(),
        'Work Complete',
        `✅ Work on "${ticket.title}" is complete and pending landlord approval.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of work done:', error);
    }
  }

  /**
   * Notify tenant when ticket is closed
   */
  private async notifyTenantOfTicketClosed(
    ticket: MaintenanceTicket,
    session: ClientSession | null = null,
  ): Promise<void> {
    try {
      const requestedByUser = await this.userModel
        .findById(ticket.requestedBy, null, { session })
        .exec();

      if (!requestedByUser || requestedByUser.user_type !== 'Tenant') {
        return;
      }

      await this.notificationsService.createNotification(
        requestedByUser._id.toString(),
        'Ticket Completed',
        `🎉 Your maintenance request "${ticket.title}" has been completed.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of ticket closed:', error);
    }
  }

  /**
   * Notify tenant when ticket is reopened
   */
  private async notifyTenantOfTicketReopened(
    ticket: MaintenanceTicket,
    session: ClientSession | null = null,
  ): Promise<void> {
    try {
      const requestedByUser = await this.userModel
        .findById(ticket.requestedBy, null, { session })
        .exec();

      if (!requestedByUser || requestedByUser.user_type !== 'Tenant') {
        return;
      }

      await this.notificationsService.createNotification(
        requestedByUser._id.toString(),
        'Ticket Reopened',
        `🔁 Your maintenance request "${ticket.title}" has been reopened for additional work.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of ticket reopened:', error);
    }
  }
}
