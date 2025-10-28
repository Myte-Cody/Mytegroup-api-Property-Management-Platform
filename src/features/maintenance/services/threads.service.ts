import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Lease } from '../../leases/schemas/lease.schema';
import { AcceptThreadDto } from '../dto/accept-thread.dto';
import { CreateThreadMessageDto } from '../dto/create-thread-message.dto';
import { CreateThreadDto } from '../dto/create-thread.dto';
import { DeclineThreadDto } from '../dto/decline-thread.dto';
import { ThreadQueryDto } from '../dto/thread-query.dto';
import { MaintenanceTicket, MaintenanceTicketDocument } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkDocument } from '../schemas/scope-of-work.schema';
import { ThreadMessage, ThreadMessageDocument } from '../schemas/thread-message.schema';
import {
  ParticipantStatus,
  ParticipantType,
  ThreadParticipant,
  ThreadParticipantDocument,
} from '../schemas/thread-participant.schema';
import {
  Thread,
  ThreadDocument,
  ThreadLinkedEntityType,
  ThreadType,
} from '../schemas/thread.schema';

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
    @InjectModel(Lease.name)
    private leaseModel: Model<Lease>,
  ) {}

  async create(createThreadDto: CreateThreadDto): Promise<ThreadDocument> {
    const { linkedEntityType, linkedEntityId, threadType, participants } = createThreadDto;

    // Check if it's a sub-SOW (for scope of work only)
    if (linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK) {
      const sow = await this.scopeOfWorkModel.findById(linkedEntityId);
      if (sow?.parentSow) {
        throw new BadRequestException('Threads cannot be created for sub-scopes of work');
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
      throw new BadRequestException('Thread of this type already exists for this entity');
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

    if (
      participant.status !== ParticipantStatus.ACCEPTED &&
      participant.status !== ParticipantStatus.ACTIVE
    ) {
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

      if (
        participant.status !== ParticipantStatus.ACCEPTED &&
        participant.status !== ParticipantStatus.ACTIVE
      ) {
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

    return this.threadParticipantModel.find({ thread: new Types.ObjectId(threadId) }).exec();
  }

  async acceptThread(
    threadId: string,
    acceptDto: AcceptThreadDto,
  ): Promise<ThreadParticipantDocument> {
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

  async declineThread(
    threadId: string,
    declineDto: DeclineThreadDto,
  ): Promise<ThreadParticipantDocument | null> {
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
    await participant.save();

    // Check if thread should be deleted
    // Delete if:
    // 1. Only landlord remains as non-declined participant, OR
    // 2. All remaining non-mandatory participants have declined
    const shouldDeleteThread = await this.shouldDeleteThreadAfterDecline(threadId);

    if (shouldDeleteThread) {
      // Delete all messages
      await this.threadMessageModel.deleteMany({ thread: new Types.ObjectId(threadId) });

      // Delete all participants
      await this.threadParticipantModel.deleteMany({ thread: new Types.ObjectId(threadId) });

      // Delete the thread
      await this.threadModel.findByIdAndDelete(threadId);

      return null;
    }

    return participant;
  }

  /**
   * Check if thread should be deleted after a participant declines
   * Returns true if:
   * 1. Only landlord remains as active/accepted participant (all others declined), OR
   * 2. All non-mandatory participants have declined
   */
  private async shouldDeleteThreadAfterDecline(threadId: string): Promise<boolean> {
    // Get all participants
    const participants = await this.threadParticipantModel.find({
      thread: new Types.ObjectId(threadId),
    });

    // Count participants by status and type
    const activeOrAcceptedNonLandlords = participants.filter(
      (p) =>
        p.participantType !== ParticipantType.LANDLORD &&
        (p.status === ParticipantStatus.ACTIVE ||
         p.status === ParticipantStatus.ACCEPTED ||
         p.status === ParticipantStatus.PENDING),
    );

    // If only landlord remains (all non-landlords have declined), delete the thread
    if (activeOrAcceptedNonLandlords.length === 0) {
      return true;
    }

    // Check if all non-mandatory participants have declined
    const nonMandatoryParticipants = participants.filter((p) => !p.isMandatory);
    const allNonMandatoryDeclined = nonMandatoryParticipants.every(
      (p) => p.status === ParticipantStatus.DECLINED,
    );

    // If all non-mandatory participants declined and there are no mandatory non-landlord participants
    if (allNonMandatoryDeclined && activeOrAcceptedNonLandlords.length === 0) {
      return true;
    }

    return false;
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

  private isParticipantMandatory(
    threadType: ThreadType,
    participantType: ParticipantType,
  ): boolean {
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

  private validateThreadType(
    linkedEntityType: ThreadLinkedEntityType,
    threadType: ThreadType,
  ): void {
    if (linkedEntityType === ThreadLinkedEntityType.TICKET) {
      if (threadType !== ThreadType.LANDLORD_TENANT) {
        throw new BadRequestException('Tickets can only have LANDLORD_TENANT thread type');
      }
    } else if (linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK) {
      if (threadType === ThreadType.LANDLORD_TENANT) {
        throw new BadRequestException(
          'Scope of Work cannot have LANDLORD_TENANT thread type (use LANDLORD_TENANT_SOW)',
        );
      }
    }
  }

  private getLinkedEntityModel(linkedEntityType: ThreadLinkedEntityType): string {
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

  /**
   * Auto-create thread for a ticket
   * Creates a LANDLORD_TENANT thread with landlord and tenant as mandatory participants
   * Contractor will be added later when they accept the ticket
   */
  async createThreadForTicket(
    ticket: MaintenanceTicketDocument,
    landlordId: string,
    tenantId: string,
  ): Promise<ThreadDocument> {
    // Check if thread already exists
    const existingThread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.TICKET,
      linkedEntityId: ticket._id,
      threadType: ThreadType.LANDLORD_TENANT,
    });

    if (existingThread) {
      return existingThread;
    }

    // Create thread
    const thread = new this.threadModel({
      title: `Ticket #${ticket.ticketNumber} - ${ticket.title}`,
      linkedEntityType: ThreadLinkedEntityType.TICKET,
      linkedEntityId: ticket._id,
      linkedEntityModel: 'MaintenanceTicket',
      threadType: ThreadType.LANDLORD_TENANT,
    });

    const savedThread = await thread.save();

    // Create participants: landlord and tenant (both mandatory)
    const participants = [
      {
        thread: savedThread._id,
        participantType: ParticipantType.LANDLORD,
        participantId: new Types.ObjectId(landlordId),
        participantModel: 'Landlord',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      },
      {
        thread: savedThread._id,
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(tenantId),
        participantModel: 'Tenant',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      },
    ];

    await this.threadParticipantModel.insertMany(participants);

    return savedThread;
  }

  /**
   * Auto-create threads for a scope of work
   * Creates multiple threads based on the SOW type:
   * - LANDLORD_TENANT_SOW (mandatory for landlord and tenant)
   * - LANDLORD_CONTRACTOR (optional for contractor, mandatory for landlord)
   * - CONTRACTOR_TENANT (optional for both)
   * - SOW_GROUP (optional for contractors/tenants, mandatory for landlord)
   */
  async createThreadsForScopeOfWork(
    sow: ScopeOfWorkDocument,
    landlordId: string,
    tenantIds: string[],
  ): Promise<ThreadDocument[]> {
    const threads: ThreadDocument[] = [];

    // 1. Create LANDLORD_TENANT_SOW thread (always created)
    const landlordTenantThread = await this.createLandlordTenantSowThread(
      sow,
      landlordId,
      tenantIds,
    );
    threads.push(landlordTenantThread);

    // 2. Create SOW_GROUP thread (always created)
    const sowGroupThread = await this.createSowGroupThread(sow, landlordId, tenantIds);
    threads.push(sowGroupThread);

    return threads;
  }

  private async createLandlordTenantSowThread(
    sow: ScopeOfWorkDocument,
    landlordId: string,
    tenantIds: string[],
  ): Promise<ThreadDocument> {
    // Check if thread already exists
    const existingThread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sow._id,
      threadType: ThreadType.LANDLORD_TENANT_SOW,
    });

    if (existingThread) {
      return existingThread;
    }

    const thread = new this.threadModel({
      title: `SOW #${sow.sowNumber} - Landlord-Tenant`,
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sow._id,
      linkedEntityModel: 'ScopeOfWork',
      threadType: ThreadType.LANDLORD_TENANT_SOW,
    });

    const savedThread = await thread.save();

    // Create participants: landlord (mandatory) and all tenants (mandatory)
    const participants = [
      {
        thread: savedThread._id,
        participantType: ParticipantType.LANDLORD,
        participantId: new Types.ObjectId(landlordId),
        participantModel: 'Landlord',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      },
      ...tenantIds.map((tenantId) => ({
        thread: savedThread._id,
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(tenantId),
        participantModel: 'Tenant',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      })),
    ];

    await this.threadParticipantModel.insertMany(participants);

    return savedThread;
  }

  private async createSowGroupThread(
    sow: ScopeOfWorkDocument,
    landlordId: string,
    tenantIds: string[],
  ): Promise<ThreadDocument> {
    // Check if thread already exists
    const existingThread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sow._id,
      threadType: ThreadType.SOW_GROUP,
    });

    if (existingThread) {
      return existingThread;
    }

    const thread = new this.threadModel({
      title: `SOW #${sow.sowNumber} - Group Chat`,
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sow._id,
      linkedEntityModel: 'ScopeOfWork',
      threadType: ThreadType.SOW_GROUP,
    });

    const savedThread = await thread.save();

    // Create participants: landlord (mandatory), tenants (optional)
    const participants = [
      {
        thread: savedThread._id,
        participantType: ParticipantType.LANDLORD,
        participantId: new Types.ObjectId(landlordId),
        participantModel: 'Landlord',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      },
      ...tenantIds.map((tenantId) => ({
        thread: savedThread._id,
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(tenantId),
        participantModel: 'Tenant',
        status: ParticipantStatus.PENDING,
        isMandatory: false,
      })),
    ];

    await this.threadParticipantModel.insertMany(participants);

    return savedThread;
  }

  /**
   * Add contractor to ticket thread when they accept the ticket
   */
  async addContractorToTicketThread(ticketId: Types.ObjectId, contractorId: string): Promise<void> {
    // Find the LANDLORD_TENANT thread for this ticket
    const thread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.TICKET,
      linkedEntityId: ticketId,
      threadType: ThreadType.LANDLORD_TENANT,
    });

    if (!thread) {
      throw new NotFoundException('Thread not found for this ticket');
    }

    // Check if contractor is already a participant
    const existingParticipant = await this.threadParticipantModel.findOne({
      thread: thread._id,
      participantType: ParticipantType.CONTRACTOR,
      participantId: new Types.ObjectId(contractorId),
    });

    if (existingParticipant) {
      return; // Already added
    }

    // Add contractor as active participant
    const participant = new this.threadParticipantModel({
      thread: thread._id,
      participantType: ParticipantType.CONTRACTOR,
      participantId: new Types.ObjectId(contractorId),
      participantModel: 'Contractor',
      status: ParticipantStatus.ACTIVE,
      isMandatory: true, // Mandatory once accepted
    });

    await participant.save();
  }

  /**
   * Add contractor to SOW threads when they accept the SOW
   */
  async addContractorToSowThreads(sowId: Types.ObjectId, contractorId: string): Promise<void> {
    // Find all threads for this SOW
    const threads = await this.threadModel.find({
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sowId,
    });

    for (const thread of threads) {
      // Check if contractor is already a participant
      const existingParticipant = await this.threadParticipantModel.findOne({
        thread: thread._id,
        participantType: ParticipantType.CONTRACTOR,
        participantId: new Types.ObjectId(contractorId),
      });

      if (existingParticipant) {
        continue; // Already added to this thread
      }

      // Determine if mandatory based on thread type
      let isMandatory = false;
      let status = ParticipantStatus.PENDING;

      if (thread.threadType === ThreadType.SOW_GROUP) {
        // In group thread, contractor is optional
        isMandatory = false;
        status = ParticipantStatus.PENDING;
      } else if (thread.threadType === ThreadType.LANDLORD_CONTRACTOR) {
        // In landlord-contractor thread, contractor is optional but typically active
        isMandatory = false;
        status = ParticipantStatus.PENDING;
      } else if (thread.threadType === ThreadType.CONTRACTOR_TENANT) {
        // In contractor-tenant thread, both are optional
        isMandatory = false;
        status = ParticipantStatus.PENDING;
      }

      // Add contractor as participant
      const participant = new this.threadParticipantModel({
        thread: thread._id,
        participantType: ParticipantType.CONTRACTOR,
        participantId: new Types.ObjectId(contractorId),
        participantModel: 'Contractor',
        status,
        isMandatory,
      });

      await participant.save();
    }

    // Create LANDLORD_CONTRACTOR thread if it doesn't exist
    await this.createLandlordContractorThread(sowId, contractorId);

    // Create CONTRACTOR_TENANT thread if it doesn't exist
    await this.createContractorTenantThread(sowId, contractorId);
  }

  private async createLandlordContractorThread(
    sowId: Types.ObjectId,
    contractorId: string,
  ): Promise<void> {
    const sow = await this.scopeOfWorkModel.findById(sowId);
    if (!sow) return;

    // Check if thread already exists
    const existingThread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sowId,
      threadType: ThreadType.LANDLORD_CONTRACTOR,
    });

    if (existingThread) return;

    // Get landlord ID from the SOW's tickets
    const ticket = await this.ticketModel.findOne({ scopeOfWork: sowId }).populate('requestedBy');
    if (!ticket) return;

    // Get landlord from the user who created the ticket
    const requestedByUser = ticket.requestedBy as any;

    let landlordId: Types.ObjectId;
    if (requestedByUser && requestedByUser.user_type === 'Landlord') {
      landlordId = requestedByUser.organization_id;
    } else {
      // If requestedBy is not landlord, we need another way to get landlord
      // This is a limitation - we might need to add landlord to property schema
      return;
    }

    const thread = new this.threadModel({
      title: `SOW #${sow.sowNumber} - Landlord-Contractor`,
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sowId,
      linkedEntityModel: 'ScopeOfWork',
      threadType: ThreadType.LANDLORD_CONTRACTOR,
    });

    const savedThread = await thread.save();

    const participants = [
      {
        thread: savedThread._id,
        participantType: ParticipantType.LANDLORD,
        participantId: landlordId,
        participantModel: 'Landlord',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      },
      {
        thread: savedThread._id,
        participantType: ParticipantType.CONTRACTOR,
        participantId: new Types.ObjectId(contractorId),
        participantModel: 'Contractor',
        status: ParticipantStatus.PENDING,
        isMandatory: false,
      },
    ];

    await this.threadParticipantModel.insertMany(participants);
  }

  private async createContractorTenantThread(
    sowId: Types.ObjectId,
    contractorId: string,
  ): Promise<void> {
    const sow = await this.scopeOfWorkModel.findById(sowId);
    if (!sow) return;

    // Check if thread already exists
    const existingThread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sowId,
      threadType: ThreadType.CONTRACTOR_TENANT,
    });

    if (existingThread) return;

    // Get tenant IDs from the SOW's tickets
    const tickets = await this.ticketModel.find({ scopeOfWork: sowId });
    const tenantIds = new Set<string>();

    for (const ticket of tickets) {
      if (!ticket.unit) continue;

      // Get tenant from lease
      const lease = await this.leaseModel.findOne({
        unit: ticket.unit,
        status: 'ACTIVE',
      });

      if (lease && lease.tenant) {
        tenantIds.add(lease.tenant.toString());
      }
    }

    if (tenantIds.size === 0) return;

    const thread = new this.threadModel({
      title: `SOW #${sow.sowNumber} - Contractor-Tenant`,
      linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
      linkedEntityId: sowId,
      linkedEntityModel: 'ScopeOfWork',
      threadType: ThreadType.CONTRACTOR_TENANT,
    });

    const savedThread = await thread.save();

    const participants = [
      {
        thread: savedThread._id,
        participantType: ParticipantType.CONTRACTOR,
        participantId: new Types.ObjectId(contractorId),
        participantModel: 'Contractor',
        status: ParticipantStatus.PENDING,
        isMandatory: false,
      },
      ...Array.from(tenantIds).map((tenantId) => ({
        thread: savedThread._id,
        participantType: ParticipantType.TENANT,
        participantId: new Types.ObjectId(tenantId),
        participantModel: 'Tenant',
        status: ParticipantStatus.PENDING,
        isMandatory: false,
      })),
    ];

    await this.threadParticipantModel.insertMany(participants);
  }
}
