import {
  BadRequestException,
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
import { createPaginatedResponse, PaginatedResponse } from '../../../common/utils/pagination.utils';
import { Contractor } from '../../../features/contractors/schema/contractor.schema';
import { Lease } from '../../../features/leases/schemas/lease.schema';
import { Property } from '../../../features/properties/schemas/property.schema';
import { Unit } from '../../../features/properties/schemas/unit.schema';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AcceptSowDto } from '../dto/accept-sow.dto';
import { AddTicketSowDto } from '../dto/add-ticket-sow.dto';
import { AssignContractorSowDto } from '../dto/assign-contractor-sow.dto';
import { CreateScopeOfWorkDto } from '../dto/create-scope-of-work.dto';
import { RefuseSowDto } from '../dto/refuse-sow.dto';
import { RemoveTicketSowDto } from '../dto/remove-ticket-sow.dto';
import { ScopeOfWorkQueryDto } from '../dto/scope-of-work-query.dto';
import { MaintenanceTicket, MaintenanceTicketDocument } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkDocument } from '../schemas/scope-of-work.schema';
import { TicketReferenceUtils } from '../utils/ticket-reference.utils';
import { SessionService } from './../../../common/services/session.service';
import { InvoicesService } from './invoices.service';
import { ThreadsService } from './threads.service';

@Injectable()
export class ScopeOfWorkService {
  constructor(
    @InjectModel(ScopeOfWork.name)
    private readonly scopeOfWorkModel: AppModel<ScopeOfWork>,
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(Contractor.name)
    private readonly contractorModel: AppModel<Contractor>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(Property.name)
    private readonly propertyModel: AppModel<Property>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    private readonly sessionService: SessionService,
    private readonly notificationsService: NotificationsService,
    @Inject(forwardRef(() => InvoicesService))
    private readonly invoicesService: InvoicesService,
    @Inject(forwardRef(() => ThreadsService))
    private readonly threadsService: ThreadsService,
  ) {}

  async findAllPaginated(
    queryDto: ScopeOfWorkQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      contractorId,
      userId,
      parentSowId,
      startDate,
      endDate,
    } = queryDto;

    // Build base query
    let baseQuery = this.scopeOfWorkModel.find();

    if (currentUser.user_type === 'Contractor') {
      baseQuery = baseQuery.where({ assignedContractor: currentUser.organization_id });
    }

    if (search) {
      // Apply filters
      baseQuery = baseQuery.where({
        sowNumber: { $regex: search, $options: 'i' },
      });
    }

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (contractorId) {
      baseQuery = baseQuery.where({ assignedContractor: contractorId });
    }

    if (userId) {
      baseQuery = baseQuery.where({ assignedUser: userId });
    }

    if (parentSowId) {
      baseQuery = baseQuery.where({ parentSow: parentSowId });
    }

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      baseQuery = baseQuery.where({ createdAt: dateFilter });
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Build sort object
    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute queries in parallel for better performance
    const [scopesOfWork, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate('assignedContractor')
        .populate('assignedUser')
        .populate('parentSow')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    // Populate tickets for each SOW
    const populatedSows = await Promise.all(
      scopesOfWork.map(async (sow) => {
        const tickets = await this.getAllTicketsRecursively(sow._id as Types.ObjectId);
        const contractors = await this.getAllContractors(tickets);
        return {
          ...sow.toObject(),
          tickets,
          contractors,
        };
      }),
    );

    return createPaginatedResponse(populatedSows, total, page, limit);
  }

  async findOne(id: string, _currentUser: UserDocument, session: ClientSession | null = null) {
    const scopeOfWork = await this.scopeOfWorkModel
      .findById(id, null, { session })
      .populate('assignedContractor')
      .populate('assignedUser')
      .populate('parentSow')
      .exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Get all tickets for this SOW and all child SOWs recursively
    const tickets = await this.getAllTicketsRecursively(scopeOfWork._id as Types.ObjectId, session);

    // Get all child SOWs recursively
    const subSows = await this.getSubSowsRecursively(scopeOfWork._id as Types.ObjectId, session);

    // Collect all contractors from tickets (without duplicates)
    let contractors = null;
    if (subSows.length > 0) {
      contractors = await this.getAllContractors(tickets, session);
    }
    return {
      ...scopeOfWork.toObject(),
      tickets,
      subSows,
      ...(contractors ? { contractors } : {}),
    };
  }

  async create(createDto: CreateScopeOfWorkDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      // Validate that all tickets exist
      const tickets = await this.ticketModel
        .find({ _id: { $in: createDto.tickets } }, null, { session })
        .exec();

      if (tickets.length !== createDto.tickets.length) {
        throw new BadRequestException('One or more tickets not found');
      }

      // Validate that all tickets have status OPEN or IN_REVIEW
      const invalidTickets = tickets.filter(
        (ticket) => ticket.status !== TicketStatus.OPEN && ticket.status !== TicketStatus.IN_REVIEW,
      );

      if (invalidTickets.length > 0) {
        const invalidTicketNumbers = invalidTickets.map((ticket) => ticket.ticketNumber).join(', ');
        throw new BadRequestException(
          `Tickets must have status OPEN or IN_REVIEW. Invalid tickets: ${invalidTicketNumbers}`,
        );
      }

      // Validate that all tickets are not already assigned to different scopes of work
      const assignedTickets = tickets.filter((ticket) => !!ticket.scopeOfWork);

      if (assignedTickets.length > 0) {
        const assignedTicketNumbers = assignedTickets
          .map((ticket) => ticket.ticketNumber)
          .join(', ');
        throw new BadRequestException(
          `Tickets must not be already assigned to other scopes of work. Already assigned tickets: ${assignedTicketNumbers}`,
        );
      }

      // Group tickets by property
      const ticketsByProperty = new Map<string, MaintenanceTicketDocument[]>();
      for (const ticket of tickets) {
        const propertyId = ticket.property.toString();
        if (!ticketsByProperty.has(propertyId)) {
          ticketsByProperty.set(propertyId, []);
        }
        ticketsByProperty.get(propertyId)!.push(ticket);
      }

      // Determine if we need to create sub-scopes
      const hasMultipleProperties = ticketsByProperty.size > 1;

      // If tickets are from a single property, check if they're from different units
      let hasMultipleUnits = false;
      if (!hasMultipleProperties) {
        const singlePropertyTickets = Array.from(ticketsByProperty.values())[0];
        const unitIds = new Set(
          singlePropertyTickets.filter((t) => t.unit).map((t) => t.unit!.toString()),
        );
        hasMultipleUnits = unitIds.size > 1;
      }

      // Create the parent SOW
      const sowNumber = await TicketReferenceUtils.generateUniqueSowNumber(
        this.scopeOfWorkModel,
        false,
        5,
        session,
      );

      // Determine property and unit for parent SOW
      // If tickets are from multiple properties/units, parent SOW won't have a specific property/unit
      const firstTicket = tickets[0];
      const parentProperty = hasMultipleProperties ? null : firstTicket.property;
      const parentUnit =
        hasMultipleProperties || hasMultipleUnits ? null : firstTicket.unit || null;

      const [scopeOfWork] = await this.scopeOfWorkModel.create(
        [
          {
            sowNumber,
            title: createDto.title,
            description: createDto.description,
            parentSow: null,
            property: parentProperty,
            unit: parentUnit,
          },
        ],
        { session },
      );

      // If tickets are from multiple properties or multiple units, create sub-scopes
      if (hasMultipleProperties) {
        // Create sub-scopes for each property
        for (const [propertyId, propertyTickets] of ticketsByProperty.entries()) {
          await this.createPropertySubScope(
            scopeOfWork,
            propertyId,
            propertyTickets,
            currentUser,
            session,
          );
        }
      } else if (hasMultipleUnits) {
        // Tickets are from same property but different units
        const propertyTickets = Array.from(ticketsByProperty.values())[0];
        const ticketsByUnit = new Map<string, MaintenanceTicketDocument[]>();
        const propertyLevelTickets: MaintenanceTicketDocument[] = [];

        for (const ticket of propertyTickets) {
          if (ticket.unit) {
            const unitId = ticket.unit.toString();
            if (!ticketsByUnit.has(unitId)) {
              ticketsByUnit.set(unitId, []);
            }
            ticketsByUnit.get(unitId)!.push(ticket);
          } else {
            propertyLevelTickets.push(ticket);
          }
        }

        // Create sub-scopes for each unit
        for (const [unitId, unitTickets] of ticketsByUnit.entries()) {
          await this.createUnitSubScope(
            scopeOfWork,
            firstTicket.property,
            unitId,
            unitTickets,
            currentUser,
            session,
          );
        }

        // If there are property-level tickets, assign them to the parent SOW
        if (propertyLevelTickets.length > 0) {
          await this.ticketModel.updateMany(
            { _id: { $in: propertyLevelTickets.map((t) => t._id) } },
            { $set: { scopeOfWork: scopeOfWork._id } },
            { session },
          );

          for (const ticket of propertyLevelTickets) {
            await this.notifyTenantOfTicketGroupedToSow(ticket, scopeOfWork, session);
          }
        }
      } else {
        // All tickets are from the same property and unit, no sub-scopes needed
        await this.ticketModel.updateMany(
          { _id: { $in: createDto.tickets } },
          { $set: { scopeOfWork: scopeOfWork._id } },
          { session },
        );

        for (const ticket of tickets) {
          await this.notifyTenantOfTicketGroupedToSow(ticket, scopeOfWork, session);
        }
      }

      // Create threads for the SOW
      await this.createSowThreads(scopeOfWork, tickets, currentUser, session);

      // Return the created SOW with populated data
      return this.findOne(scopeOfWork._id.toString(), currentUser, session);
    });
  }

  /**
   * Creates a sub-scope of work for a specific property
   * If the property has tickets from multiple units, creates unit sub-scopes
   */
  private async createPropertySubScope(
    parentSow: ScopeOfWorkDocument,
    propertyId: string,
    tickets: MaintenanceTicketDocument[],
    currentUser: UserDocument,
    session: ClientSession,
  ): Promise<ScopeOfWorkDocument> {
    // Group tickets by unit within this property
    const ticketsByUnit = new Map<string, MaintenanceTicketDocument[]>();
    const propertyLevelTickets: MaintenanceTicketDocument[] = [];

    for (const ticket of tickets) {
      if (ticket.unit) {
        const unitId = ticket.unit.toString();
        if (!ticketsByUnit.has(unitId)) {
          ticketsByUnit.set(unitId, []);
        }
        ticketsByUnit.get(unitId)!.push(ticket);
      } else {
        propertyLevelTickets.push(ticket);
      }
    }

    // Generate sub-SOW number for property
    const propertySowNumber = await TicketReferenceUtils.generateUniqueSowNumber(
      this.scopeOfWorkModel,
      true,
      5,
      session,
    );

    // Get property name for title
    const property = await this.propertyModel.findById(propertyId, null, { session }).exec();
    const propertyName = property?.name || 'Property';

    // Create property sub-scope
    const [propertySubScope] = await this.scopeOfWorkModel.create(
      [
        {
          sowNumber: propertySowNumber,
          title: `${parentSow.title} - ${propertyName}`,
          description: parentSow.description,
          parentSow: parentSow._id,
          property: propertyId,
          unit: null,
        },
      ],
      { session },
    );

    // If tickets are from multiple units, create unit sub-scopes
    if (ticketsByUnit.size > 1) {
      for (const [unitId, unitTickets] of ticketsByUnit.entries()) {
        await this.createUnitSubScope(
          propertySubScope,
          propertyId,
          unitId,
          unitTickets,
          currentUser,
          session,
        );
      }

      // If there are property-level tickets, assign them to the property sub-scope
      if (propertyLevelTickets.length > 0) {
        await this.ticketModel.updateMany(
          { _id: { $in: propertyLevelTickets.map((t) => t._id) } },
          { $set: { scopeOfWork: propertySubScope._id } },
          { session },
        );

        for (const ticket of propertyLevelTickets) {
          await this.notifyTenantOfTicketGroupedToSow(ticket, propertySubScope, session);
        }
      }
    } else {
      // All tickets are from the same unit or are property-level, assign to property sub-scope
      await this.ticketModel.updateMany(
        { _id: { $in: tickets.map((t) => t._id) } },
        { $set: { scopeOfWork: propertySubScope._id } },
        { session },
      );

      for (const ticket of tickets) {
        await this.notifyTenantOfTicketGroupedToSow(ticket, propertySubScope, session);
      }
    }

    return propertySubScope;
  }

  /**
   * Creates a sub-scope of work for a specific unit
   */
  private async createUnitSubScope(
    parentSow: ScopeOfWorkDocument,
    propertyId: string | Types.ObjectId,
    unitId: string,
    tickets: MaintenanceTicketDocument[],
    _currentUser: UserDocument,
    session: ClientSession,
  ): Promise<ScopeOfWorkDocument> {
    // Generate sub-SOW number for unit
    const unitSowNumber = await TicketReferenceUtils.generateUniqueSowNumber(
      this.scopeOfWorkModel,
      true,
      5,
      session,
    );

    // Get unit name for title
    const unit = await this.unitModel.findById(unitId, null, { session }).exec();
    const unitName = unit?.unitNumber || 'Unit';

    // Create unit sub-scope
    const [unitSubScope] = await this.scopeOfWorkModel.create(
      [
        {
          sowNumber: unitSowNumber,
          title: `${parentSow.title} - ${unitName}`,
          description: parentSow.description,
          parentSow: parentSow._id,
          property: propertyId,
          unit: unitId,
        },
      ],
      { session },
    );

    // Assign all tickets to this unit sub-scope
    await this.ticketModel.updateMany(
      { _id: { $in: tickets.map((t) => t._id) } },
      { $set: { scopeOfWork: unitSubScope._id } },
      { session },
    );

    for (const ticket of tickets) {
      await this.notifyTenantOfTicketGroupedToSow(ticket, unitSubScope, session);
    }

    return unitSubScope;
  }

  async remove(id: string, _currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Determine the new SOW reference for tickets:
      // - If this is a sub-SOW (has a parent), reassign tickets to the parent
      // - Otherwise, set tickets to null
      const newSowReference = scopeOfWork.parentSow || null;

      // Update children SOWs to set parentSow to the parent of the removed SOW (or null)
      await this.scopeOfWorkModel.updateMany(
        { parentSow: scopeOfWork._id },
        { $set: { parentSow: newSowReference } },
        { session },
      );

      // Update tickets: assign to parent SOW if exists, otherwise null
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        { $set: { scopeOfWork: newSowReference } },
        { session },
      );

      // Soft delete the scope of work
      await this.scopeOfWorkModel.findByIdAndDelete(id, { session });

      return { message: 'Scope of Work deleted successfully' };
    });
  }

  async markInReview(id: string, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Check if this is a parent SOW (has child SOWs)
      const childSows = await this.scopeOfWorkModel
        .find({ parentSow: scopeOfWork._id }, null, { session })
        .exec();

      // If this is a parent SOW, check if it has tickets directly assigned to it
      if (childSows.length > 0) {
        const ticketsCount = await this.ticketModel
          .countDocuments({ scopeOfWork: scopeOfWork._id }, { session })
          .exec();

        const allChildSowsInReview = childSows.every(
          (sow) => sow.status === TicketStatus.IN_REVIEW,
        );

        // If parent SOW has no tickets, user should update sub-SOWs instead
        if (ticketsCount === 0) {
          throw new BadRequestException(
            'Cannot mark parent SOW as in review. Please update the sub SOWs instead.',
          );
        }

        // If parent SOW has tickets, all child SOWs must be in review first
        if (ticketsCount > 0 && !allChildSowsInReview) {
          throw new BadRequestException(
            'Cannot mark parent SOW as in review. All sub SOWs must be in review first.',
          );
        }
      }

      // Update SOW status to IN_REVIEW
      scopeOfWork.status = TicketStatus.IN_REVIEW;
      await scopeOfWork.save({ session });

      // Update all tickets in this SOW to IN_REVIEW
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        { $set: { status: TicketStatus.IN_REVIEW } },
        { session },
      );

      // Update parent SOWs if this is a sub-SOW
      if (scopeOfWork.parentSow) {
        await this.updateParentSowsStatus(scopeOfWork.parentSow, TicketStatus.IN_REVIEW, session);
      }

      return this.findOne(id, currentUser, session);
    });
  }

  async assignContractor(id: string, assignDto: AssignContractorSowDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Update the SOW with the contractor and assignedDate
      scopeOfWork.assignedContractor = assignDto.contractorId as any;
      scopeOfWork.assignedDate = new Date();
      scopeOfWork.status = TicketStatus.ASSIGNED;
      await scopeOfWork.save({ session });

      // Update all tickets in this SOW with the contractor
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        {
          $set: {
            status: TicketStatus.ASSIGNED,
            assignedContractor: assignDto.contractorId,
            assignedBy: currentUser._id,
            assignedDate: new Date(),
          },
        },
        { session },
      );
      if (scopeOfWork.parentSow) {
        await this.updateParentSowsStatus(scopeOfWork.parentSow, TicketStatus.ASSIGNED, session);
      }

      return this.findOne(id, currentUser, session);
    });
  }

  async addTicket(id: string, addTicketDto: AddTicketSowDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Validate that the ticket exists
      const ticket = await this.ticketModel
        .findById(addTicketDto.ticketId, null, { session })
        .exec();
      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${addTicketDto.ticketId} not found`);
      }

      // Validate that ticket has status OPEN or IN_REVIEW
      if (ticket.status !== TicketStatus.OPEN && ticket.status !== TicketStatus.IN_REVIEW) {
        throw new BadRequestException(
          `Ticket must have status OPEN or IN_REVIEW. Current status: ${ticket.status}`,
        );
      }

      // Check if ticket is already in another SOW
      if (ticket.scopeOfWork && ticket.scopeOfWork.toString() !== id) {
        throw new BadRequestException('Ticket is already assigned to another scope of work');
      }

      // Get existing tickets in this SOW
      const existingTickets = await this.ticketModel
        .find({ scopeOfWork: scopeOfWork._id }, null, { session })
        .exec();

      // Validate that the new ticket is compatible with existing tickets
      if (existingTickets.length > 0) {
        const firstTicket = existingTickets[0];

        // Case 1: All existing tickets are property-level (no unit)
        if (!firstTicket.unit) {
          // New ticket must also be property-level and same property
          if (ticket.unit) {
            throw new BadRequestException(
              'Cannot add unit-level ticket to a scope of work with property-level tickets',
            );
          }
          if (ticket.property.toString() !== firstTicket.property.toString()) {
            throw new BadRequestException(
              'Ticket must be associated with the same property as existing tickets in this scope of work',
            );
          }
        }
        // Case 2: All existing tickets are unit-level
        else {
          // New ticket must also be unit-level and same unit
          if (!ticket.unit) {
            throw new BadRequestException(
              'Cannot add property-level ticket to a scope of work with unit-level tickets',
            );
          }
          if (ticket.unit.toString() !== firstTicket.unit.toString()) {
            throw new BadRequestException(
              'Ticket must be associated with the same unit as existing tickets in this scope of work',
            );
          }
        }
      }

      // Add ticket to SOW
      ticket.scopeOfWork = scopeOfWork._id as any;

      // If SOW has an assigned contractor, assign it to the ticket as well
      if (scopeOfWork.assignedContractor) {
        ticket.assignedContractor = scopeOfWork.assignedContractor;
        ticket.assignedBy = currentUser._id as any;
        ticket.assignedDate = new Date();
      }

      if (scopeOfWork.assignedUser) {
        ticket.assignedUser = scopeOfWork.assignedUser;
      }

      await ticket.save({ session });

      // Notify tenant that ticket has been grouped into SOW
      await this.notifyTenantOfTicketGroupedToSow(ticket, scopeOfWork, session);

      return this.findOne(id, currentUser, session);
    });
  }

  async removeTicket(id: string, removeTicketDto: RemoveTicketSowDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Validate that the ticket exists and belongs to this SOW
      const ticket = await this.ticketModel
        .findById(removeTicketDto.ticketId, null, { session })
        .exec();
      if (!ticket) {
        throw new NotFoundException(`Ticket with ID ${removeTicketDto.ticketId} not found`);
      }

      if (!ticket.scopeOfWork || ticket.scopeOfWork.toString() !== id) {
        throw new BadRequestException('Ticket is not part of this scope of work');
      }

      // Remove ticket from SOW
      ticket.scopeOfWork = null;
      await ticket.save({ session });

      return this.findOne(id, currentUser, session);
    });
  }

  async acceptSow(id: string, acceptDto: AcceptSowDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Verify the user exists
      const user = await this.userModel.findById(acceptDto.userId, null, { session }).exec();
      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Update SOW status to IN_PROGRESS
      scopeOfWork.status = TicketStatus.IN_PROGRESS;
      scopeOfWork.assignedUser = new Types.ObjectId(acceptDto.userId);
      await scopeOfWork.save({ session });

      // Update all tickets in this SOW to IN_PROGRESS
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        {
          $set: {
            status: TicketStatus.IN_PROGRESS,
            assignedUser: new Types.ObjectId(acceptDto.userId),
          },
        },
        { session },
      );

      // Add contractor to SOW threads
      if (scopeOfWork.assignedContractor) {
        try {
          await this.threadsService.addContractorToSowThreads(
            scopeOfWork._id as Types.ObjectId,
            scopeOfWork.assignedContractor.toString(),
          );
        } catch (error) {
          // Log error but don't fail SOW acceptance
          console.error('Failed to add contractor to SOW threads:', error);
        }
      }

      // Recursively update parent SOWs to IN_PROGRESS if they exist
      await this.updateParentSowsStatus(scopeOfWork.parentSow, TicketStatus.IN_PROGRESS, session);

      return this.findOne(id, currentUser, session);
    });
  }

  async refuseSow(id: string, refuseDto: RefuseSowDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, session).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Update SOW status to OPEN and clear contractor assignment
      scopeOfWork.status = TicketStatus.OPEN;
      scopeOfWork.assignedContractor = null;
      scopeOfWork.assignedDate = null;
      if (refuseDto.refuseReason) {
        scopeOfWork.refuseReason = refuseDto.refuseReason;
      }
      await scopeOfWork.save({ session });

      // Update all tickets in this SOW
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        {
          $set: {
            status: TicketStatus.OPEN,
            assignedContractor: null,
            assignedDate: null,
            refuseReason: refuseDto.refuseReason || null,
          },
        },
        { session },
      );

      // Recursively update parent SOWs
      await this.updateParentSowsStatus(scopeOfWork.parentSow, TicketStatus.OPEN, session);

      return this.findOne(id, currentUser, session);
    });
  }

  async closeSow(id: string, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Only allow closing top-level SOWs (those without a parent)
      if (scopeOfWork.parentSow) {
        throw new BadRequestException(
          'Cannot close a sub-SOW directly. Please close the parent SOW instead.',
        );
      }

      // Get all child SOWs recursively (sub-SOWs at all depths)
      const subSows = await this.getSubSowsRecursively(scopeOfWork._id as Types.ObjectId, session);

      // Flatten all sub-SOWs to get their IDs
      const flattenSubSows = (sowList: any[]): any[] => {
        const result: any[] = [];
        for (const sow of sowList) {
          result.push(sow);
          if (sow.subSows && sow.subSows.length > 0) {
            result.push(...flattenSubSows(sow.subSows));
          }
        }
        return result;
      };

      const allSubSows = flattenSubSows(subSows);

      // Check if all child SOWs are DONE
      if (allSubSows.length > 0) {
        const allChildSowsDone = allSubSows.every((sow) => sow.status === TicketStatus.DONE);

        if (!allChildSowsDone) {
          throw new BadRequestException('Cannot close SOW: not all child SOWs are done');
        }
      }

      // Get all tickets for this SOW recursively
      const tickets = await this.getAllTicketsRecursively(
        scopeOfWork._id as Types.ObjectId,
        session,
      );

      // Check if all tickets are DONE
      const allTicketsDone = tickets.every((ticket) => ticket.status === TicketStatus.DONE);

      if (!allTicketsDone) {
        throw new BadRequestException('Cannot close SOW: not all tickets are done');
      }

      // Update SOW status to CLOSED
      scopeOfWork.status = TicketStatus.CLOSED;
      await scopeOfWork.save({ session });

      // Notify tenants that thread is closed
      await this.threadsService.notifyTenantsOfThreadClosed(scopeOfWork._id as Types.ObjectId);

      // Close all sub-SOWs recursively at all depths
      if (allSubSows.length > 0) {
        await this.scopeOfWorkModel.updateMany(
          { _id: { $in: allSubSows.map((sow) => sow._id) } },
          { $set: { status: TicketStatus.CLOSED } },
          { session },
        );
      }

      await this.ticketModel.updateMany(
        { _id: { $in: tickets.map((ticket) => ticket._id) } },
        { $set: { status: TicketStatus.CLOSED } },
        { session },
      );

      // Auto-confirm all pending invoices for this scope of work
      await this.invoicesService.confirmInvoicesByLinkedEntity(
        scopeOfWork._id as Types.ObjectId,
        InvoiceLinkedEntityType.SCOPE_OF_WORK,
        session,
      );

      return this.findOne(id, currentUser, session);
    });
  }

  /**
   * Recursively get all tickets from this SOW and all its child SOWs
   */
  async getAllTicketsRecursively(
    sowId: Types.ObjectId,
    session: ClientSession | null = null,
  ): Promise<any[]> {
    // Get tickets for the current SOW
    const tickets = await this.ticketModel
      .find({ scopeOfWork: sowId }, null, { session })
      .populate('scopeOfWork')
      .populate('assignedContractor')
      .populate('assignedUser')
      .exec();

    // Find all direct children SOWs
    const childSows = await this.scopeOfWorkModel
      .find({ parentSow: sowId }, null, { session })
      .exec();

    // Recursively get tickets from all child SOWs
    const childTickets = await Promise.all(
      childSows.map((childSow) =>
        this.getAllTicketsRecursively(childSow._id as Types.ObjectId, session),
      ),
    );

    // Flatten and combine all tickets
    return [...tickets, ...childTickets.flat()];
  }

  /**
   * Recursively get all child SOWs with their tickets
   */
  private async getSubSowsRecursively(
    sowId: Types.ObjectId,
    session: ClientSession | null = null,
  ): Promise<any[]> {
    // Find all direct children SOWs
    const childSows = await this.scopeOfWorkModel
      .find({ parentSow: sowId }, null, { session })
      .populate('assignedContractor')
      .populate('assignedUser')
      .exec();

    if (childSows.length === 0) {
      return [];
    }

    // For each child SOW, get its tickets and recursively get its sub-SOWs
    const subSows = await Promise.all(
      childSows.map(async (childSow) => {
        // Get tickets for this child SOW recursively
        const tickets = await this.getAllTicketsRecursively(
          childSow._id as Types.ObjectId,
          session,
        );

        // Recursively get sub-SOWs of this child SOW
        const childSubSows = await this.getSubSowsRecursively(
          childSow._id as Types.ObjectId,
          session,
        );

        return {
          ...childSow.toObject(),
          tickets,
          subSows: childSubSows,
        };
      }),
    );

    return subSows;
  }

  /**
   * Recursively update parent SOWs status based on all tickets (direct and from sub-SOWs)
   */
  async updateParentSowsStatus(
    parentSowId: Types.ObjectId | undefined | null,
    status: TicketStatus,
    session: ClientSession | null = null,
  ): Promise<void> {
    if (!parentSowId) {
      return;
    }

    const parentSow = await this.scopeOfWorkModel.findById(parentSowId, null, { session }).exec();
    if (!parentSow) {
      return;
    }

    // Get all tickets from parent SOW (direct tickets and tickets from all sub-SOWs recursively)
    const allTickets = await this.getAllTicketsRecursively(parentSowId, session);

    // Only update if there are tickets
    if (allTickets.length === 0) {
      return;
    }

    // Check if all tickets have the same status
    const allTicketsHaveSameStatus = allTickets.every((ticket) => ticket.status === status);

    // Only update parent SOW status if all tickets have the same status
    if (allTicketsHaveSameStatus) {
      parentSow.status = status;
      if (status == TicketStatus.ASSIGNED) {
        parentSow.assignedDate = new Date();
      }
      if (status == TicketStatus.DONE) {
        parentSow.completedDate = new Date();
      }
      await parentSow.save({ session });

      // Recursively update grandparent SOWs
      if (parentSow.parentSow) {
        await this.updateParentSowsStatus(parentSow.parentSow, status, session);
      }
    }
  }

  /**
   * Collect unique contractors from tickets only (not from sub-SOWs)
   * Should only be called if the SOW is a parent (has at least one sub SOW)
   */
  private async getAllContractors(
    tickets: any[],
    session: ClientSession | null = null,
  ): Promise<any[]> {
    // Use a Set to store unique contractor IDs
    const uniqueContractorIds = new Set<string>();

    // Collect contractor IDs from tickets only
    for (const ticket of tickets) {
      if (ticket.assignedContractor) {
        // Convert to string for Set uniqueness
        const contractorId =
          typeof ticket.assignedContractor === 'object'
            ? ticket.assignedContractor._id.toString()
            : ticket.assignedContractor.toString();
        uniqueContractorIds.add(contractorId);
      }
    }

    // If no contractors found, return empty array
    if (uniqueContractorIds.size === 0) {
      return [];
    }

    // Convert Set back to ObjectId array for query
    const contractorIds = Array.from(uniqueContractorIds).map((id) => new Types.ObjectId(id));

    // Fetch unique contractors from database
    const contractors = await this.contractorModel
      .find(
        {
          _id: { $in: contractorIds },
        },
        null,
        { session },
      )
      .exec();

    return contractors;
  }

  /**
   * Create threads automatically when a scope of work is created
   */
  private async createSowThreads(
    sow: ScopeOfWork,
    tickets: MaintenanceTicket[],
    currentUser: UserDocument,
    session: ClientSession | null,
  ): Promise<void> {
    try {
      // Get unique tenant IDs from tickets
      const tenantIds = new Set<string>();

      for (const ticket of tickets) {
        if (!ticket.unit) continue;

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

        if (lease && lease.tenant) {
          tenantIds.add(lease.tenant.toString());
        }
      }

      if (tenantIds.size === 0) {
        // No tenants found, can't create threads
        return;
      }

      // Get landlord ID
      let landlordId: string;

      if (currentUser.user_type === 'Landlord') {
        landlordId = currentUser.organization_id.toString();
      } else {
        // If not created by landlord, find a landlord user
        const landlordUser = await this.userModel
          .findOne({ user_type: 'Landlord' }, null, { session })
          .exec();

        if (!landlordUser) {
          // No landlord found, can't create threads
          return;
        }

        landlordId = landlordUser.organization_id.toString();
      }

      // Create threads for the SOW
      await this.threadsService.createThreadsForScopeOfWork(
        sow as any,
        landlordId,
        Array.from(tenantIds),
      );
    } catch (error) {
      // Log error but don't fail SOW creation
      console.error('Failed to create threads for SOW:', error);
    }
  }

  /**
   * Notify tenant when their ticket is grouped into a SOW
   */
  private async notifyTenantOfTicketGroupedToSow(
    ticket: MaintenanceTicket,
    scopeOfWork: ScopeOfWork,
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
        'Ticket Grouped',
        `📦 Your maintenance request "${ticket.title}" has been grouped into a maintenance job (${scopeOfWork.sowNumber}). The work will still be processed as part of that job.`,
      );
    } catch (error) {
      console.error('Failed to notify tenant of ticket grouped to SOW:', error);
    }
  }
}
