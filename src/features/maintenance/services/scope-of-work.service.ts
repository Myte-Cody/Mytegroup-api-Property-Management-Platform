import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { UserDocument } from '../../users/schemas/user.schema';
import { AddTicketSowDto } from '../dto/add-ticket-sow.dto';
import { AssignContractorSowDto } from '../dto/assign-contractor-sow.dto';
import { CreateScopeOfWorkDto } from '../dto/create-scope-of-work.dto';
import { RemoveTicketSowDto } from '../dto/remove-ticket-sow.dto';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';
import { TicketReferenceUtils } from '../utils/ticket-reference.utils';

@Injectable()
export class ScopeOfWorkService {
  constructor(
    @InjectModel(ScopeOfWork.name)
    private readonly scopeOfWorkModel: AppModel<ScopeOfWork>,
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
  ) {}

  async findAll(currentUser: UserDocument) {
    const scopesOfWork = await this.scopeOfWorkModel
      .find()
      .populate('assignedContractor')
      .populate('parentSow')
      .exec();

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

    return populatedSows;
  }

  async findOne(id: string, currentUser: UserDocument) {
    const scopeOfWork = await this.scopeOfWorkModel
      .findById(id)
      .populate('assignedContractor')
      .populate('parentSow')
      .exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Get all tickets for this SOW
    const tickets = await this.ticketModel.find({ scopeOfWork: scopeOfWork._id }).exec();

    return {
      ...scopeOfWork.toObject(),
      tickets,
    };
  }

  async create(createDto: CreateScopeOfWorkDto, currentUser: UserDocument) {
    // Validate that all tickets exist
    const tickets = await this.ticketModel.find({ _id: { $in: createDto.tickets } }).exec();

    if (tickets.length !== createDto.tickets.length) {
      throw new BadRequestException('One or more tickets not found');
    }

    // Validate parent SOW if provided
    if (createDto.parentSow) {
      const parentSow = await this.scopeOfWorkModel.findById(createDto.parentSow).exec();
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
    const scopeOfWork = await this.scopeOfWorkModel.create({
      sowNumber,
      parentSow: createDto.parentSow || null,
    });

    // Update all tickets to reference this SOW
    await this.ticketModel.updateMany(
      { _id: { $in: createDto.tickets } },
      { $set: { scopeOfWork: scopeOfWork._id } },
    );

    // Return the created SOW with populated data
    return this.findOne(scopeOfWork._id.toString(), currentUser);
  }

  async remove(id: string, currentUser: UserDocument) {
    const scopeOfWork = await this.scopeOfWorkModel.findById(id).exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Update children SOWs to set parentSow to null
    await this.scopeOfWorkModel.updateMany(
      { parentSow: scopeOfWork._id },
      { $set: { parentSow: null } },
    );

    // Remove SOW reference from all tickets
    await this.ticketModel.updateMany(
      { scopeOfWork: scopeOfWork._id },
      { $set: { scopeOfWork: null } },
    );

    // Soft delete the scope of work
    await this.scopeOfWorkModel.findByIdAndDelete(id);

    return { message: 'Scope of Work deleted successfully' };
  }

  async assignContractor(id: string, assignDto: AssignContractorSowDto, currentUser: UserDocument) {
    const scopeOfWork = await this.scopeOfWorkModel.findById(id).exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Update the SOW with the contractor
    scopeOfWork.assignedContractor = assignDto.contractorId as any;
    await scopeOfWork.save();

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
    );

    return this.findOne(id, currentUser);
  }

  async addTicket(id: string, addTicketDto: AddTicketSowDto, currentUser: UserDocument) {
    const scopeOfWork = await this.scopeOfWorkModel.findById(id).exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Validate that the ticket exists
    const ticket = await this.ticketModel.findById(addTicketDto.ticketId).exec();
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${addTicketDto.ticketId} not found`);
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

    await ticket.save();

    return this.findOne(id, currentUser);
  }

  async removeTicket(id: string, removeTicketDto: RemoveTicketSowDto, currentUser: UserDocument) {
    const scopeOfWork = await this.scopeOfWorkModel.findById(id).exec();

    if (!scopeOfWork) {
      throw new NotFoundException(`Scope of Work with ID ${id} not found`);
    }

    // Validate that the ticket exists and belongs to this SOW
    const ticket = await this.ticketModel.findById(removeTicketDto.ticketId).exec();
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${removeTicketDto.ticketId} not found`);
    }

    if (!ticket.scopeOfWork || ticket.scopeOfWork.toString() !== id) {
      throw new BadRequestException('Ticket is not part of this scope of work');
    }

    // Remove ticket from SOW
    ticket.scopeOfWork = null;
    await ticket.save();

    return this.findOne(id, currentUser);
  }
}
