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
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AcceptSowDto } from '../dto/accept-sow.dto';
import { AddTicketSowDto } from '../dto/add-ticket-sow.dto';
import { AssignContractorSowDto } from '../dto/assign-contractor-sow.dto';
import { CreateScopeOfWorkDto } from '../dto/create-scope-of-work.dto';
import { RefuseSowDto } from '../dto/refuse-sow.dto';
import { RemoveTicketSowDto } from '../dto/remove-ticket-sow.dto';
import { ScopeOfWorkQueryDto } from '../dto/scope-of-work-query.dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';
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
    private readonly sessionService: SessionService,
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
      const assignedTickets = tickets.filter(
        (ticket) => !!ticket.scopeOfWork && ticket.scopeOfWork.toString() != createDto.parentSow,
      );

      if (assignedTickets.length > 0) {
        const assignedTicketNumbers = assignedTickets
          .map((ticket) => ticket.ticketNumber)
          .join(', ');
        throw new BadRequestException(
          `Tickets must not be already assigned to other scopes of work. Already assigned tickets: ${assignedTicketNumbers}`,
        );
      }

      // Validate parent SOW if provided
      if (createDto.parentSow) {
        const parentSow = await this.scopeOfWorkModel
          .findById(createDto.parentSow, null, { session })
          .exec();
        if (!parentSow) {
          throw new BadRequestException('Parent scope of work not found');
        }
      }

      // Generate SOW number
      const sowNumber = await TicketReferenceUtils.generateUniqueSowNumber(
        this.scopeOfWorkModel,
        !!createDto.parentSow,
      );

      // Create the scope of work
      const [scopeOfWork] = await this.scopeOfWorkModel.create(
        [
          {
            sowNumber,
            title: createDto.title,
            description: createDto.description,
            parentSow: createDto.parentSow || null,
          },
        ],
        { session },
      );

      // Update all tickets to reference this SOW
      await this.ticketModel.updateMany(
        { _id: { $in: createDto.tickets } },
        { $set: { scopeOfWork: scopeOfWork._id } },
        { session },
      );

      // Create threads for the SOW
      await this.createSowThreads(scopeOfWork, tickets, currentUser, session);

      // Return the created SOW with populated data
      return this.findOne(scopeOfWork._id.toString(), currentUser, session);
    });
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

      if (childSows.length > 0) {
        throw new BadRequestException(
          'Cannot mark parent SOW as in review. Please update the sub SOWs instead.',
        );
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

      // Get all child SOWs (sub-SOWs)
      const childSows = await this.scopeOfWorkModel
        .find({ parentSow: scopeOfWork._id }, null, { session })
        .exec();

      // Check if all child SOWs are CLOSED
      if (childSows.length > 0) {
        const allChildSowsDone = childSows.every((sow) => sow.status === TicketStatus.DONE);

        if (!allChildSowsDone) {
          throw new BadRequestException('Cannot close SOW: not all child SOWs are done');
        }
      }

      // Get all tickets for this SOW
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

      await this.scopeOfWorkModel.updateMany(
        { _id: { $in: childSows.map((sow) => sow._id) } },
        { $set: { status: TicketStatus.CLOSED } },
        { session },
      );

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
}
