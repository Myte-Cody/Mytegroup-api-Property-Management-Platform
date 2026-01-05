import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { NotificationType } from '@shared/notification-types';
import { Model, Types } from 'mongoose';
import { Contractor } from '../../contractors/schema/contractor.schema';
import { Lease } from '../../leases/schemas/lease.schema';
import { Media } from '../../media/schemas/media.schema';
import { MediaService } from '../../media/services/media.service';
import { NotificationDispatcherService } from '../../notifications/notification-dispatcher.service';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { User, UserDocument } from '../../users/schemas/user.schema';
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
    @InjectModel(Media.name)
    private mediaModel: Model<Media>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Contractor.name)
    private contractorModel: Model<Contractor>,
    @InjectModel(Tenant.name)
    private tenantModel: Model<Tenant>,
    private mediaService: MediaService,
    private notificationDispatcher: NotificationDispatcherService,
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

    // Enrich media with URLs for all messages in the thread
    if ((thread as any).messages && (thread as any).messages.length > 0) {
      for (const message of (thread as any).messages) {
        if ((message as any).media && (message as any).media.length > 0) {
          const enrichedMedia = await Promise.all(
            (message as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
          );
          (message as any).media = enrichedMedia;
        }
      }
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

    // Enrich media with URLs for all messages in all threads
    for (const thread of threads) {
      if ((thread as any).messages && (thread as any).messages.length > 0) {
        for (const message of (thread as any).messages) {
          if (message.media && message.media.length > 0) {
            const enrichedMedia = await Promise.all(
              message.media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
            );
            message.media = enrichedMedia;
          }
        }
      }
    }

    return threads;
  }

  async addMessage(
    threadId: string,
    createMessageDto: CreateThreadMessageDto,
    currentUser: User,
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

    const savedMessage = await message.save();
    // Upload media files if provided
    if (createMessageDto.media && createMessageDto.media.length > 0) {
      for (const file of createMessageDto.media) {
        // Validate media type (only image or PDF allowed)
        const allowedMimeTypes = [
          'image/jpeg',
          'image/png',
          'image/gif',
          'image/webp',
          'image/jpg',
          'application/pdf',
        ];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          // Delete the message and throw error
          await this.threadMessageModel.findByIdAndDelete(savedMessage._id);
          throw new BadRequestException(
            `Invalid media type. Only images and PDFs are allowed. Found: ${file.mimetype}`,
          );
        }
        try {
          // Upload media and link to the message using the actual user
          await this.mediaService.upload(
            file,
            savedMessage,
            currentUser,
            'thread-messages',
            undefined,
            'ThreadMessage',
          );
        } catch (error) {
          // If upload fails, delete the message and re-throw
          await this.threadMessageModel.findByIdAndDelete(savedMessage._id);
          throw error;
        }
      }
    }

    // Populate media with URLs before returning
    const messageWithMedia = await this.threadMessageModel
      .findById(savedMessage._id)
      .populate('media')
      .exec();

    // Enrich media with URLs
    const hasAttachments =
      messageWithMedia &&
      (messageWithMedia as any).media &&
      (messageWithMedia as any).media.length > 0;

    if (hasAttachments) {
      const enrichedMedia = await Promise.all(
        (messageWithMedia as any).media.map((media: any) =>
          this.mediaService.enrichMediaWithUrl(media),
        ),
      );
      // Replace media array with enriched version
      (messageWithMedia as any).media = enrichedMedia;
    }

    // Send notification to landlord if message was sent by tenant or contractor
    if (createMessageDto.senderType === 'TENANT' || createMessageDto.senderType === 'CONTRACTOR') {
      await this.notifyLandlordOfNewMessage(
        thread,
        createMessageDto.senderType,
        createMessageDto.senderId,
        hasAttachments,
      );
    }

    // Send notification to tenants if message was sent by landlord or contractor
    if (
      createMessageDto.senderType === 'LANDLORD' ||
      createMessageDto.senderType === 'CONTRACTOR'
    ) {
      await this.notifyTenantsOfNewMessage(
        thread,
        createMessageDto.senderType,
        createMessageDto.senderId,
        hasAttachments,
      );
    }

    return messageWithMedia || savedMessage;
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

    const messages = await this.threadMessageModel
      .find({ thread: new Types.ObjectId(threadId) })
      .sort({ createdAt: 1 })
      .populate('media')
      .exec();

    // Enrich media with URLs for all messages
    for (const message of messages) {
      if ((message as any).media && (message as any).media.length > 0) {
        const enrichedMedia = await Promise.all(
          (message as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
        );
        (message as any).media = enrichedMedia;
      }
    }

    return messages;
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
      case ThreadLinkedEntityType.PROPERTY:
        return 'Property';
      case ThreadLinkedEntityType.LEASE:
        return 'Lease';
      case ThreadLinkedEntityType.TENANT_CHAT:
        return 'Tenant';
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
   * Auto-create thread for a lease activation
   * Creates a LANDLORD_TENANT thread linked to the property
   * If a thread already exists for the property, adds the tenant as a participant
   */
  async createThreadForLease(
    leaseId: string,
    landlordId: string,
    tenantId: string,
  ): Promise<ThreadDocument> {
    // Get lease details to find the property
    const lease = await this.leaseModel
      .findById(leaseId)
      .populate({
        path: 'unit',
        select: 'unitNumber property',
        populate: { path: 'property', select: 'name' },
      })
      .populate('tenant', 'name');

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    const unit = lease.unit as any;
    const property = unit?.property as any;
    const propertyId = property?._id;

    if (!propertyId) {
      throw new NotFoundException('Property not found for lease');
    }

    const propertyName = property?.name || 'Property';

    // Check if thread already exists for this property
    const existingThread = await this.threadModel.findOne({
      linkedEntityType: ThreadLinkedEntityType.PROPERTY,
      linkedEntityId: propertyId,
      threadType: ThreadType.LANDLORD_TENANT,
    });

    if (existingThread) {
      // Thread exists, add tenant users as participants if not already added
      await this.addTenantUsersToThread(existingThread, tenantId);
      return existingThread;
    }

    // Create new thread linked to property
    const thread = new this.threadModel({
      title: propertyName,
      linkedEntityType: ThreadLinkedEntityType.PROPERTY,
      linkedEntityId: propertyId,
      linkedEntityModel: 'Property',
      threadType: ThreadType.LANDLORD_TENANT,
    });

    const savedThread = await thread.save();

    // Get all landlord users
    const landlordUsers = await this.userModel
      .find({
        organization_id: new Types.ObjectId(landlordId),
        user_type: 'Landlord',
        deleted: { $ne: true },
      })
      .select('_id');

    // Get all tenant users
    const tenantUsers = await this.userModel
      .find({
        organization_id: new Types.ObjectId(tenantId),
        user_type: 'Tenant',
        deleted: { $ne: true },
      })
      .select('_id');

    // Create participants for all landlord users
    const landlordParticipants = landlordUsers.map((user) => ({
      thread: savedThread._id,
      participantType: ParticipantType.LANDLORD,
      participantId: user._id,
      participantModel: 'User',
      status: ParticipantStatus.ACTIVE,
      isMandatory: true,
    }));

    // Create participants for all tenant users
    const tenantParticipants = tenantUsers.map((user) => ({
      thread: savedThread._id,
      participantType: ParticipantType.TENANT,
      participantId: user._id,
      participantModel: 'User',
      status: ParticipantStatus.ACTIVE,
      isMandatory: true,
    }));

    const allParticipants = [...landlordParticipants, ...tenantParticipants];

    if (allParticipants.length > 0) {
      await this.threadParticipantModel.insertMany(allParticipants);
    }

    // Send notifications to all users of both landlord and tenant
    await this.sendLeaseThreadNotifications(savedThread, landlordId, tenantId);

    return savedThread;
  }

  /**
   * Add tenant users to an existing thread if they are not already participants
   */
  private async addTenantUsersToThread(thread: ThreadDocument, tenantId: string): Promise<void> {
    // Get all tenant users
    const tenantUsers = await this.userModel
      .find({
        organization_id: new Types.ObjectId(tenantId),
        user_type: 'Tenant',
        deleted: { $ne: true },
      })
      .select('_id');

    // Get existing participants for this thread
    const existingParticipants = await this.threadParticipantModel
      .find({ thread: thread._id })
      .select('participantId');

    const existingParticipantIds = new Set(
      existingParticipants.map((p) => p.participantId.toString()),
    );

    // Create participants for tenant users who are not already in the thread
    const newParticipants = tenantUsers
      .filter((user) => !existingParticipantIds.has(user._id.toString()))
      .map((user) => ({
        thread: thread._id,
        participantType: ParticipantType.TENANT,
        participantId: user._id,
        participantModel: 'User',
        status: ParticipantStatus.ACTIVE,
        isMandatory: true,
      }));

    if (newParticipants.length > 0) {
      await this.threadParticipantModel.insertMany(newParticipants);
    }
  }

  /**
   * Send notifications to all landlord and tenant users about the new lease thread
   */
  private async sendLeaseThreadNotifications(
    thread: ThreadDocument,
    landlordId: string,
    tenantId: string,
  ): Promise<void> {
    try {
      // Get all landlord users
      const landlordUsers = await this.userModel
        .find({
          organization_id: new Types.ObjectId(landlordId),
          user_type: 'Landlord',
        })
        .select('_id');

      // Get all tenant users
      const tenantUsers = await this.userModel
        .find({
          organization_id: new Types.ObjectId(tenantId),
          user_type: 'Tenant',
        })
        .select('_id');

      // Create notifications for all users
      const allUsers = [...landlordUsers, ...tenantUsers];

      for (const user of allUsers) {
        const dashboardPath = user.user_type === 'Landlord' ? 'landlord' : 'tenant';
        await this.notificationDispatcher.sendInAppNotification(
          user._id.toString(),
          NotificationType.MESSAGE_NEW_GROUP,
          'New Communication Channel',
          `A new communication thread has been created for your lease: ${thread.title}`,
          `/dashboard/${dashboardPath}/chat`,
        );
      }
    } catch (error) {
      // Log error but don't fail the lease activation
      console.error('Error sending lease thread notifications:', error);
    }
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

    // Notify tenants that they've been invited to the group thread
    await this.notifyTenantsOfThreadInvitation(savedThread, tenantIds);

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

  /**
   * Notify landlord of new message or attachment in thread
   */
  private async notifyLandlordOfNewMessage(
    thread: ThreadDocument,
    senderType: string,
    senderId: string,
    hasAttachments: boolean,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel.findOne({ user_type: 'Landlord' }).exec();

      if (!landlordUser) {
        return;
      }

      // Get sender information
      let senderName = 'User';
      if (senderType === 'TENANT') {
        const tenant = await this.tenantModel.findById(senderId).exec();
        if (tenant) {
          const tenantUser = await this.userModel
            .findOne({ organization_id: tenant._id, user_type: 'Tenant' })
            .exec();
          if (tenantUser) {
            senderName =
              tenantUser.firstName && tenantUser.lastName
                ? `${tenantUser.firstName} ${tenantUser.lastName}`
                : tenantUser.username;
          }
        }
      } else if (senderType === 'CONTRACTOR') {
        const contractor = await this.contractorModel.findById(senderId).exec();
        if (contractor) {
          senderName = contractor.name || 'Contractor';
        }
      }

      // Get the entity title (ticket or SOW)
      let entityTitle = 'Thread';
      if (thread.linkedEntityType === ThreadLinkedEntityType.TICKET && thread.linkedEntityId) {
        const ticket = await this.ticketModel.findById(thread.linkedEntityId).exec();
        if (ticket) {
          entityTitle = ticket.title;
        }
      } else if (
        thread.linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK &&
        thread.linkedEntityId
      ) {
        const sow = await this.scopeOfWorkModel.findById(thread.linkedEntityId).exec();
        if (sow) {
          entityTitle = `SOW #${(sow as any).sowNumber || sow._id}`;
        }
      }

      // Build the correct action URL based on thread's linked entity
      const landlordDashboard = landlordUser.user_type === 'Contractor' ? 'contractor' : 'landlord';
      let actionUrl = `/dashboard/${landlordDashboard}/chat`;

      if (thread.linkedEntityType === ThreadLinkedEntityType.TICKET && thread.linkedEntityId) {
        actionUrl = `/dashboard/${landlordDashboard}/maintenance/tickets/${thread.linkedEntityId}`;
      } else if (
        thread.linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK &&
        thread.linkedEntityId
      ) {
        actionUrl = `/dashboard/${landlordDashboard}/maintenance/scope-of-work/${thread.linkedEntityId}`;
      }

      // Send appropriate notification based on whether there are attachments
      if (hasAttachments) {
        await this.notificationDispatcher.sendInAppNotification(
          landlordUser._id.toString(),
          NotificationType.MESSAGE_NEW_DIRECT,
          'New Attachment',
          `📎 ${senderName} attached a file in ${entityTitle}.`,
          actionUrl,
        );
      } else {
        await this.notificationDispatcher.sendInAppNotification(
          landlordUser._id.toString(),
          NotificationType.MESSAGE_NEW_DIRECT,
          'New Message',
          `💬 ${senderName} sent a new message in ${entityTitle}.`,
          actionUrl,
        );
      }
    } catch (error) {
      console.error('Failed to notify landlord of new message:', error);
    }
  }

  /**
   * Notify tenants of new message or attachment in thread
   */
  private async notifyTenantsOfNewMessage(
    thread: ThreadDocument,
    senderType: string,
    senderId: string,
    hasAttachments: boolean,
  ): Promise<void> {
    try {
      // Get all tenant participants in this thread
      const tenantParticipants = await this.threadParticipantModel
        .find({
          thread: thread._id,
          participantType: ParticipantType.TENANT,
          status: { $in: [ParticipantStatus.ACCEPTED, ParticipantStatus.ACTIVE] },
        })
        .exec();

      if (tenantParticipants.length === 0) {
        return;
      }

      // Get sender information
      let senderName = 'User';
      if (senderType === 'LANDLORD') {
        const landlord = await this.userModel.findOne({ user_type: 'Landlord' }).exec();
        if (landlord) {
          senderName =
            landlord.firstName && landlord.lastName
              ? `${landlord.firstName} ${landlord.lastName}`
              : landlord.username;
        }
      } else if (senderType === 'CONTRACTOR') {
        const contractor = await this.contractorModel.findById(senderId).exec();
        if (contractor) {
          senderName = contractor.name || 'Contractor';
        }
      }

      // Get the entity title (ticket or SOW)
      let entityTitle = thread.title || 'Thread';
      if (
        thread.linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK &&
        thread.linkedEntityId
      ) {
        const sow = await this.scopeOfWorkModel.findById(thread.linkedEntityId).exec();
        if (sow) {
          entityTitle = sow.title || `SOW #${(sow as any).sowNumber || sow._id}`;
        }
      } else if (
        thread.linkedEntityType === ThreadLinkedEntityType.TICKET &&
        thread.linkedEntityId
      ) {
        const ticket = await this.ticketModel.findById(thread.linkedEntityId).exec();
        if (ticket) {
          entityTitle = ticket.title;
        }
      }

      // Get tenant users
      const tenantIds = tenantParticipants.map((p) => p.participantId);
      const tenantUsers = await this.userModel
        .find({
          user_type: 'Tenant',
          organization_id: { $in: tenantIds },
        })
        .exec();

      // Send appropriate notification based on whether there are attachments
      const notificationPromises = tenantUsers.map((user) => {
        const userDashboard =
          user.user_type === 'Contractor'
            ? 'contractor'
            : user.user_type === 'Landlord'
              ? 'landlord'
              : 'tenant';

        // Build the correct action URL based on thread's linked entity
        let actionUrl = `/dashboard/${userDashboard}/chat`;

        if (thread.linkedEntityType === ThreadLinkedEntityType.TICKET && thread.linkedEntityId) {
          actionUrl = `/dashboard/${userDashboard}/maintenance/tickets/${thread.linkedEntityId}`;
        } else if (
          thread.linkedEntityType === ThreadLinkedEntityType.SCOPE_OF_WORK &&
          thread.linkedEntityId
        ) {
          actionUrl = `/dashboard/${userDashboard}/maintenance/scope-of-work/${thread.linkedEntityId}`;
        }

        if (hasAttachments) {
          return this.notificationDispatcher.sendInAppNotification(
            user._id.toString(),
            NotificationType.MESSAGE_NEW_GROUP,
            'New Attachment',
            `📎 A new file was shared in ${entityTitle}.`,
            actionUrl,
          );
        } else {
          return this.notificationDispatcher.sendInAppNotification(
            user._id.toString(),
            NotificationType.MESSAGE_NEW_GROUP,
            'New Message',
            `💬 ${senderName} sent you a message in ${entityTitle}.`,
            actionUrl,
          );
        }
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Failed to notify tenants of new message:', error);
    }
  }

  /**
   * Notify tenants when invited to SOW group thread
   */
  private async notifyTenantsOfThreadInvitation(
    thread: ThreadDocument,
    tenantIds: string[],
  ): Promise<void> {
    try {
      // Get SOW title
      let sowTitle = 'discussion';
      if (thread.linkedEntityId) {
        const sow = await this.scopeOfWorkModel.findById(thread.linkedEntityId).exec();
        if (sow) {
          sowTitle = sow.title || `SOW #${(sow as any).sowNumber || sow._id}`;
        }
      }

      // Get tenant users
      const tenantUsers = await this.userModel
        .find({
          user_type: 'Tenant',
          organization_id: { $in: tenantIds.map((id) => new Types.ObjectId(id)) },
        })
        .exec();

      // Send notifications
      const notificationPromises = tenantUsers.map((user) => {
        const userDashboard =
          user.user_type === 'Contractor'
            ? 'contractor'
            : user.user_type === 'Landlord'
              ? 'landlord'
              : 'tenant';
        return this.notificationDispatcher.sendInAppNotification(
          user._id.toString(),
          NotificationType.MESSAGE_GROUP_INVITE,
          'Thread Invitation',
          `📨 You've been invited to join the discussion in ${sowTitle}.`,
          `/dashboard/${userDashboard}/chat`,
        );
      });

      await Promise.all(notificationPromises);

      // TODO: Add email notification here if needed
      // await this.sendThreadInvitationEmail(tenantUsers, sowTitle);
    } catch (error) {
      console.error('Failed to notify tenants of thread invitation:', error);
    }
  }

  /**
   * Notify tenants when thread is closed (SOW completed)
   * Should be called when SOW status changes to CLOSED
   */
  async notifyTenantsOfThreadClosed(sowId: Types.ObjectId): Promise<void> {
    try {
      // Get SOW
      const sow = await this.scopeOfWorkModel.findById(sowId).exec();
      if (!sow) {
        return;
      }

      // Get all threads for this SOW
      const threads = await this.threadModel
        .find({
          linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
          linkedEntityId: sowId,
        })
        .exec();

      if (threads.length === 0) {
        return;
      }

      // Get all tenant participants from all threads
      const tenantParticipants = await this.threadParticipantModel
        .find({
          thread: { $in: threads.map((t) => t._id) },
          participantType: ParticipantType.TENANT,
        })
        .exec();

      if (tenantParticipants.length === 0) {
        return;
      }

      // Get unique tenant IDs
      const uniqueTenantIds = [
        ...new Set(tenantParticipants.map((p) => p.participantId.toString())),
      ];

      // Get tenant users
      const tenantUsers = await this.userModel
        .find({
          user_type: 'Tenant',
          organization_id: { $in: uniqueTenantIds.map((id) => new Types.ObjectId(id)) },
        })
        .exec();

      const sowTitle = sow.title || `SOW #${(sow as any).sowNumber || sow._id}`;

      // Send notifications
      const notificationPromises = tenantUsers.map((user) => {
        const userDashboard =
          user.user_type === 'Contractor'
            ? 'contractor'
            : user.user_type === 'Landlord'
              ? 'landlord'
              : 'tenant';
        return this.notificationDispatcher.sendInAppNotification(
          user._id.toString(),
          NotificationType.MESSAGE_NEW_GROUP,
          'Discussion Closed',
          `✅ The discussion for ${sowTitle} has been closed.`,
          `/dashboard/${userDashboard}/chat`,
        );
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Failed to notify tenants of thread closed:', error);
    }
  }

  /**
   * Notify tenants when thread is reopened (SOW reactivated)
   * Should be called when SOW status changes from CLOSED to another status
   */
  async notifyTenantsOfThreadReopened(sowId: Types.ObjectId): Promise<void> {
    try {
      // Get SOW
      const sow = await this.scopeOfWorkModel.findById(sowId).exec();
      if (!sow) {
        return;
      }

      // Get all threads for this SOW
      const threads = await this.threadModel
        .find({
          linkedEntityType: ThreadLinkedEntityType.SCOPE_OF_WORK,
          linkedEntityId: sowId,
        })
        .exec();

      if (threads.length === 0) {
        return;
      }

      // Get all tenant participants from all threads
      const tenantParticipants = await this.threadParticipantModel
        .find({
          thread: { $in: threads.map((t) => t._id) },
          participantType: ParticipantType.TENANT,
        })
        .exec();

      if (tenantParticipants.length === 0) {
        return;
      }

      // Get unique tenant IDs
      const uniqueTenantIds = [
        ...new Set(tenantParticipants.map((p) => p.participantId.toString())),
      ];

      // Get tenant users
      const tenantUsers = await this.userModel
        .find({
          user_type: 'Tenant',
          organization_id: { $in: uniqueTenantIds.map((id) => new Types.ObjectId(id)) },
        })
        .exec();

      const sowTitle = sow.title || `SOW #${(sow as any).sowNumber || sow._id}`;

      // Send notifications
      const notificationPromises = tenantUsers.map((user) => {
        const userDashboard =
          user.user_type === 'Contractor'
            ? 'contractor'
            : user.user_type === 'Landlord'
              ? 'landlord'
              : 'tenant';
        return this.notificationDispatcher.sendInAppNotification(
          user._id.toString(),
          NotificationType.MESSAGE_NEW_GROUP,
          'Discussion Reopened',
          `🔁 The discussion for ${sowTitle} has been reopened.`,
          `/dashboard/${userDashboard}/chat`,
        );
      });

      await Promise.all(notificationPromises);
    } catch (error) {
      console.error('Failed to notify tenants of thread reopened:', error);
    }
  }
}
