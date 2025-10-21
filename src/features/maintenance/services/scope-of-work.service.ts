import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';
import { TicketStatus } from '../../../common/enums/maintenance.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { createPaginatedResponse, PaginatedResponse } from '../../../common/utils/pagination.utils';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AcceptSowDto } from '../dto/accept-sow.dto';
import { AddTicketSowDto } from '../dto/add-ticket-sow.dto';
import { AssignContractorSowDto } from '../dto/assign-contractor-sow.dto';
import { CloseSowDto } from '../dto/close-sow.dto';
import { CreateScopeOfWorkDto } from '../dto/create-scope-of-work.dto';
import { RefuseSowDto } from '../dto/refuse-sow.dto';
import { RemoveTicketSowDto } from '../dto/remove-ticket-sow.dto';
import { ScopeOfWorkQueryDto } from '../dto/scope-of-work-query.dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';
import { TicketReferenceUtils } from '../utils/ticket-reference.utils';
import { SessionService } from './../../../common/services/session.service';

@Injectable()
export class ScopeOfWorkService {
  constructor(
    @InjectModel(ScopeOfWork.name)
    private readonly scopeOfWorkModel: AppModel<ScopeOfWork>,
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly sessionService: SessionService,
  ) {}

  async findAllPaginated(queryDto: ScopeOfWorkQueryDto, currentUser: UserDocument): Promise<PaginatedResponse> {
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
    } = queryDto;

    // Build base query
    let baseQuery = this.scopeOfWorkModel.find();

    // Apply filters
    if (search) {
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
        const tickets = await this.ticketModel.find({ scopeOfWork: sow._id }).exec();
        return {
          ...sow.toObject(),
          tickets,
        };
      }),
    );

    return createPaginatedResponse(populatedSows, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument, session: ClientSession | null = null) {
    const scopeOfWork = await this.scopeOfWorkModel
      .findById(id, null, { session })
      .populate('assignedContractor')
      .populate('assignedUser')
      .populate('parentSow')
      .exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Get all tickets for this SOW
    const tickets = await this.ticketModel
      .find({ scopeOfWork: scopeOfWork._id }, null, { session })
      .exec();

    return {
      ...scopeOfWork.toObject(),
      tickets,
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
        const invalidTicketIds = invalidTickets.map((ticket) => ticket._id.toString()).join(', ');
        throw new BadRequestException(
          `Tickets must have status OPEN or IN_REVIEW. Invalid tickets: ${invalidTicketIds}`,
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

      // Update children SOWs to set parentSow to null
      await this.scopeOfWorkModel.updateMany(
        { parentSow: scopeOfWork._id },
        { $set: { parentSow: null } },
        { session },
      );

      // Remove SOW reference from all tickets
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        { $set: { scopeOfWork: null } },
        { session },
      );

      // Soft delete the scope of work
      await this.scopeOfWorkModel.findByIdAndDelete(id, { session });

      return { message: 'Scope of Work deleted successfully' };
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
      await scopeOfWork.save({ session });

      // Update all tickets in this SOW with the contractor
      await this.ticketModel.updateMany(
        { scopeOfWork: scopeOfWork._id },
        {
          $set: {
            assignedContractor: assignDto.contractorId,
            assignedBy: currentUser._id,
            assignedDate: new Date(),
          },
        },
        { session },
      );

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

  async closeSow(id: string, closeDto: CloseSowDto, currentUser: UserDocument) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const scopeOfWork = await this.scopeOfWorkModel.findById(id, null, { session }).exec();

      if (!scopeOfWork) {
        throw new NotFoundException(`Scope of Work with ID ${id} not found`);
      }

      // Get all tickets for this SOW
      const tickets = await this.ticketModel
        .find({ scopeOfWork: scopeOfWork._id }, null, { session })
        .exec();

      // Check if all tickets are DONE or CLOSED
      const allTicketsDoneOrClosed = tickets.every(
        (ticket) => ticket.status === TicketStatus.DONE || ticket.status === TicketStatus.CLOSED,
      );

      if (!allTicketsDoneOrClosed) {
        throw new BadRequestException('Cannot close SOW: not all tickets are done or closed');
      }

      // Get all child SOWs (sub-SOWs)
      const childSows = await this.scopeOfWorkModel
        .find({ parentSow: scopeOfWork._id }, null, { session })
        .exec();

      // Check if all child SOWs are CLOSED
      if (childSows.length > 0) {
        const allChildSowsClosed = childSows.every((sow) => sow.status === TicketStatus.CLOSED);

        if (!allChildSowsClosed) {
          throw new BadRequestException('Cannot close SOW: not all child SOWs are closed');
        }
      }

      // Update SOW status to CLOSED
      scopeOfWork.status = TicketStatus.CLOSED;
      scopeOfWork.notes = closeDto.notes;
      await scopeOfWork.save({ session });

      return this.findOne(id, currentUser, session);
    });
  }

  /**
   * Recursively update parent SOWs status
   */
  private async updateParentSowsStatus(
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

    // Update parent SOW status
    parentSow.status = status;
    await parentSow.save({ session });

    // Update all parent tickets
    await this.ticketModel.updateMany(
      { scopeOfWork: parentSow._id },
      {
        $set: { status },
      },
      { session },
    );

    // Recursively update grandparent SOWs
    if (parentSow.parentSow) {
      await this.updateParentSowsStatus(parentSow.parentSow, status, session);
    }
  }
}
