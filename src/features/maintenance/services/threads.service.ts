import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Thread, ThreadDocument, ThreadLinkedEntityType, ThreadType } from '../schemas/thread.schema';
import { ThreadMessage, ThreadMessageDocument } from '../schemas/thread-message.schema';
import { ThreadParticipant, ThreadParticipantDocument, ParticipantStatus, ParticipantType } from '../schemas/thread-participant.schema';
import { MaintenanceTicket, MaintenanceTicketDocument } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkDocument } from '../schemas/scope-of-work.schema';
import { CreateThreadDto } from '../dto/create-thread.dto';
import { CreateThreadMessageDto } from '../dto/create-thread-message.dto';
import { ThreadQueryDto } from '../dto/thread-query.dto';
import { AcceptThreadDto } from '../dto/accept-thread.dto';
import { DeclineThreadDto } from '../dto/decline-thread.dto';

@Injectable()
export class ThreadsService {
  constructor(
    @InjectModel(Thread.name)
    private threadModel: Model<ThreadDocument>,
    @InjectModel(ThreadMessage.name)
    private threadMessageModel: Model<ThreadMessageDocument>,
    @InjectModel(ThreadParticipant.name)
    private threadParticipantModel: Model<ThreadParticipantDocument>,
    @InjectModel(MaintenanceTicket.name)
    private ticketModel: Model<MaintenanceTicketDocument>,
    @InjectModel(ScopeOfWork.name)
    private scopeOfWorkModel: Model<ScopeOfWorkDocument>,
  ) {}

  async create(createThreadDto: CreateThreadDto): Promise<ThreadDocument> {
    const { linkedEntityType, linkedEntityId, threadType, participants } = createThreadDto;

    // Check if it's a sub-SOW (for scope of work only)
    if (linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK) {
      const sow = await this.scopeOfWorkModel.findById(linkedEntityId);
      if (sow?.parentSow) {
        throw new BadRequestException(
          'Threads cannot be created for sub-scopes of work',
        );
      }
    }

    // Validate thread type matches entity type
    this.validateThreadType(linkedEntityType, threadType);

    // Check if thread already exists for this entity and type
    const existingThread = await this.threadModel.findOne({
      linkedEntityType,
      linkedEntityId: new Types.ObjectId(linkedEntityId),
      threadType,
    });

    if (existingThread) {
      throw new BadRequestException(
        'Thread of this type already exists for this entity',
      );
    }

    const linkedEntityModel = this.getLinkedEntityModel(linkedEntityType);

    const thread = new this.threadModel({
      ...createThreadDto,
      linkedEntityId: new Types.ObjectId(linkedEntityId),
      linkedEntityModel,
    });

    const savedThread = await thread.save();

    // Create participants
    if (participants && participants.length > 0) {
      await this.createParticipants(savedThread._id.toString(), threadType, participants);
    }

    return savedThread;
  }

  async findAll(query: ThreadQueryDto): Promise<{
    data: ThreadDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = 1,
      limit = 10,
      linkedEntityType,
      linkedEntityId,
      threadType,
      participantId,
      participantStatus,
    } = query;
    const skip = (page - 1) * limit;

    const filter: any = {};
    if (linkedEntityType) {
      filter.linkedEntityType = linkedEntityType;
    }
    if (linkedEntityId) {
      filter.linkedEntityId = new Types.ObjectId(linkedEntityId);
    }
    if (threadType) {
      filter.threadType = threadType;
    }

    // If filtering by participant, we need to join with participants
    if (participantId || participantStatus) {
      const participantFilter: any = {};
      if (participantId) {
        participantFilter.participantId = new Types.ObjectId(participantId);
      }
      if (participantStatus) {
        participantFilter.status = participantStatus;
      }

      const participantThreadIds = await this.threadParticipantModel
        .find(participantFilter)
        .distinct('thread');

      filter._id = { $in: participantThreadIds };
    }

    const [data, total] = await Promise.all([
      this.threadModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('participants')
        .exec(),
      this.threadModel.countDocuments(filter),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<ThreadDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid thread ID');
    }

    const thread = await this.threadModel
      .findById(id)
      .populate('participants')
      .populate({
        path: 'messages',
        options: { sort: { createdAt: 1 } },
        populate: {
          path: 'media',
          model: 'Media',
        },
      })
      .exec();

    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return thread;
  }

  async getThreadByEntity(
    linkedEntityType: ThreadLinkedEntityType,
    linkedEntityId: string,
    threadType?: ThreadType,
  ): Promise<ThreadDocument[]> {
    if (!Types.ObjectId.isValid(linkedEntityId)) {
      throw new BadRequestException('Invalid entity ID');
    }

    const filter: any = {
      linkedEntityType,
      linkedEntityId: new Types.ObjectId(linkedEntityId),
    };

    if (threadType) {
      filter.threadType = threadType;
    }

    const threads = await this.threadModel
      .find(filter)
      .populate('participants')
      .populate({
        path: 'messages',
        options: { sort: { createdAt: 1 } },
        populate: {
          path: 'media',
          model: 'Media',
        },
      })
      .exec();

    return threads;
  }

  async addMessage(
    threadId: string,
    createMessageDto: CreateThreadMessageDto,
  ): Promise<ThreadMessageDocument> {
    if (!Types.ObjectId.isValid(threadId)) {
      throw new BadRequestException('Invalid thread ID');
    }

    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // Check if sender is an accepted participant
    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(createMessageDto.senderId),
      participantType: createMessageDto.senderType,
    });

    if (!participant) {
      throw new ForbiddenException('You are not a participant in this thread');
    }

    if (participant.status !== ParticipantStatus.ACCEPTED && participant.status !== ParticipantStatus.ACTIVE) {
      throw new ForbiddenException('You must accept the thread invitation before sending messages');
    }

    const senderModel = this.getSenderModel(createMessageDto.senderType);

    const message = new this.threadMessageModel({
      thread: new Types.ObjectId(threadId),
      content: createMessageDto.content,
      senderType: createMessageDto.senderType,
      senderId: new Types.ObjectId(createMessageDto.senderId),
      senderModel,
    });

    return message.save();
  }

  async getMessages(threadId: string, participantId?: string): Promise<ThreadMessageDocument[]> {
    if (!Types.ObjectId.isValid(threadId)) {
      throw new BadRequestException('Invalid thread ID');
    }

    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    // If participantId is provided, check if they have access
    if (participantId) {
      const participant = await this.threadParticipantModel.findOne({
        thread: new Types.ObjectId(threadId),
        participantId: new Types.ObjectId(participantId),
      });

      if (!participant) {
        throw new ForbiddenException('You are not a participant in this thread');
      }

      if (participant.status !== ParticipantStatus.ACCEPTED && participant.status !== ParticipantStatus.ACTIVE) {
        throw new ForbiddenException('You must accept the thread invitation to view messages');
      }
    }

    return this.threadMessageModel
      .find({ thread: new Types.ObjectId(threadId) })
      .sort({ createdAt: 1 })
      .populate('media')
      .exec();
  }

  async getParticipants(threadId: string): Promise<ThreadParticipantDocument[]> {
    if (!Types.ObjectId.isValid(threadId)) {
      throw new BadRequestException('Invalid thread ID');
    }

    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    return this.threadParticipantModel
      .find({ thread: new Types.ObjectId(threadId) })
      .exec();
  }

  async acceptThread(threadId: string, acceptDto: AcceptThreadDto): Promise<ThreadParticipantDocument> {
    if (!Types.ObjectId.isValid(threadId)) {
      throw new BadRequestException('Invalid thread ID');
    }

    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(acceptDto.participantId),
      participantType: acceptDto.participantType,
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this thread');
    }

    if (participant.isMandatory) {
      throw new BadRequestException('Mandatory participants cannot accept/decline');
    }

    if (participant.status === ParticipantStatus.ACCEPTED) {
      throw new BadRequestException('Thread already accepted');
    }

    participant.status = ParticipantStatus.ACCEPTED;
    return participant.save();
  }

  async declineThread(threadId: string, declineDto: DeclineThreadDto): Promise<ThreadParticipantDocument> {
    if (!Types.ObjectId.isValid(threadId)) {
      throw new BadRequestException('Invalid thread ID');
    }

    const thread = await this.threadModel.findById(threadId);
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }

    const participant = await this.threadParticipantModel.findOne({
      thread: new Types.ObjectId(threadId),
      participantId: new Types.ObjectId(declineDto.participantId),
      participantType: declineDto.participantType,
    });

    if (!participant) {
      throw new NotFoundException('Participant not found in this thread');
    }

    if (participant.isMandatory) {
      throw new BadRequestException('Mandatory participants cannot accept/decline');
    }

    if (participant.status === ParticipantStatus.DECLINED) {
      throw new BadRequestException('Thread already declined');
    }

    participant.status = ParticipantStatus.DECLINED;
    return participant.save();
  }

  private async createParticipants(
    threadId: string,
    threadType: ThreadType,
    participants: Array<{ participantType: ParticipantType; participantId: string }>,
  ): Promise<void> {
    const participantDocs = participants.map((p) => {
      const isMandatory = this.isParticipantMandatory(threadType, p.participantType);
      const status = isMandatory ? ParticipantStatus.ACTIVE : ParticipantStatus.PENDING;

      return {
        thread: new Types.ObjectId(threadId),
        participantType: p.participantType,
        participantId: new Types.ObjectId(p.participantId),
        participantModel: this.getSenderModel(p.participantType),
        status,
        isMandatory,
      };
    });

    await this.threadParticipantModel.insertMany(participantDocs);
  }

  private isParticipantMandatory(threadType: ThreadType, participantType: ParticipantType): boolean {
    // Landlords are always mandatory
    if (participantType === ParticipantType.LANDLORD) {
      return true;
    }

    // Tenants are mandatory in landlord-tenant threads
    if (
      participantType === ParticipantType.TENANT &&
      (threadType === ThreadType.LANDLORD_TENANT || threadType === ThreadType.LANDLORD_TENANT_SOW)
    ) {
      return true;
    }

    // Contractors are mandatory when added to ticket thread after accepting ticket
    // This will be handled separately when contractor accepts the ticket

    return false;
  }

  private validateThreadType(linkedEntityType: ThreadLinkedEntityType, threadType: ThreadType): void {
    if (linkedEntityType === ThreadLinkedEntityType.TICKET) {
      if (threadType !== ThreadType.LANDLORD_TENANT) {
        throw new BadRequestException(
          'Tickets can only have LANDLORD_TENANT thread type',
        );
      }
    } else if (linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK) {
      if (threadType === ThreadType.LANDLORD_TENANT) {
        throw new BadRequestException(
          'Scope of Work cannot have LANDLORD_TENANT thread type (use LANDLORD_TENANT_SOW)',
        );
      }
    }
  }

  private getLinkedEntityModel(
    linkedEntityType: ThreadLinkedEntityType,
  ): string {
    switch (linkedEntityType) {
      case ThreadLinkedEntityType.TICKET:
        return 'MaintenanceTicket';
      case ThreadLinkedEntityType.SCOPE_OF_WORK:
        return 'ScopeOfWork';
      default:
        throw new BadRequestException('Invalid linked entity type');
    }
  }

  private getSenderModel(senderType: string): string {
    switch (senderType) {
      case 'LANDLORD':
        return 'Landlord';
      case 'TENANT':
        return 'Tenant';
      case 'CONTRACTOR':
        return 'Contractor';
      default:
        throw new BadRequestException('Invalid sender type');
    }
  }
}
