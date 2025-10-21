import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';
import { LeaseStatus } from '../../../common/enums/lease.enum';
import { TicketStatus } from '../../../common/enums/maintenance.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { Contractor } from '../../contractors/schema/contractor.schema';
import { Lease } from '../../leases';
import { MediaService } from '../../media/services/media.service';
import { Property } from '../../properties/schemas/property.schema';
import { Unit } from '../../properties/schemas/unit.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
import {
  AcceptTicketDto,
  AssignTicketDto,
  CloseTicketDto,
  CreateTicketDto,
  RefuseTicketDto,
  TicketQueryDto,
  UpdateTicketDto,
} from '../dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';
import { TicketReferenceUtils } from '../utils/ticket-reference.utils';
import { SessionService } from './../../../common/services/session.service';

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

    return {
      ...ticket.toObject(),
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
    if (!updateTicketDto || Object.keys(updateTicketDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    const existingTicket = await this.ticketModel.findById(id).exec();

    if (!existingTicket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    this.validateUpdatePermissions(existingTicket, currentUser, updateTicketDto);

    if (updateTicketDto.status && updateTicketDto.status !== existingTicket.status) {
      await this.handleStatusChange(existingTicket, updateTicketDto.status);
    }

    Object.assign(existingTicket, updateTicketDto);
    return await existingTicket.save();
  }

  async assignTicket(
    id: string,
    assignDto: AssignTicketDto,
    currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
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

    return await ticket.save();
  }

  async acceptTicket(
    id: string,
    acceptDto: AcceptTicketDto,
    _currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
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

    return await ticket.save();
  }

  async refuseTicket(
    id: string,
    refuseDto: RefuseTicketDto,
    _currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
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

    return await ticket.save();
  }

  async markAsDone(id: string, _currentUser: UserDocument): Promise<MaintenanceTicket> {
    const ticket = await this.ticketModel.findById(id).exec();
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // Update ticket status to DONE
    ticket.status = TicketStatus.DONE;
    ticket.completedDate = new Date();

    const savedTicket = await ticket.save();

    // Check if the ticket has a scope of work
    if (ticket.scopeOfWork) {
      // Update SOW status if all tickets are done
      await this.updateSowStatusRecursively(ticket.scopeOfWork);
    }

    return savedTicket;
  }

  async closeTicket(
    id: string,
    closeDto: CloseTicketDto,
    _currentUser: UserDocument,
  ): Promise<MaintenanceTicket> {
    const ticket = await this.ticketModel.findById(id).exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // Update ticket status to CLOSED
    ticket.status = TicketStatus.CLOSED;
    if (closeDto.cost) {
      ticket.cost = closeDto.cost;
    }

    return await ticket.save();
  }

  async reopenTicket(id: string, _currentUser: UserDocument): Promise<MaintenanceTicket> {
    const ticket = await this.ticketModel.findById(id).populate('scopeOfWork').exec();

    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }

    // Check if ticket has a scope of work and if that SOW is closed
    if (ticket.scopeOfWork) {
      const scopeOfWork = ticket.scopeOfWork as unknown as ScopeOfWork;
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

    return await ticket.save();
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

  private async areAllTicketsInSowDone(sowId: Types.ObjectId): Promise<boolean> {
    const tickets = await this.ticketModel.find({ scopeOfWork: sowId }).exec();

    if (tickets.length === 0) {
      return false;
    }

    return tickets.every((ticket) => ticket.status === TicketStatus.DONE);
  }

  private async updateSowStatusRecursively(sowId: Types.ObjectId): Promise<void> {
    const sow = await this.scopeOfWorkModel.findById(sowId).exec();

    if (!sow) {
      return;
    }

    // Check if all tickets in this SOW are done
    const allTicketsDone = await this.areAllTicketsInSowDone(sowId);

    if (allTicketsDone) {
      // Update this SOW status to DONE
      sow.status = TicketStatus.DONE;
      await sow.save();

      // If this SOW has a parent, check and update the parent recursively
      if (sow.parentSow) {
        // Check if all child SOWs of the parent are done
        const siblingsSows = await this.scopeOfWorkModel.find({ parentSow: sow.parentSow }).exec();

        const allSiblingsDone = siblingsSows.every(
          (sibling) => sibling.status === TicketStatus.DONE,
        );

        if (allSiblingsDone) {
          await this.updateSowStatusRecursively(sow.parentSow);
        }
      }
    }
  }
}
