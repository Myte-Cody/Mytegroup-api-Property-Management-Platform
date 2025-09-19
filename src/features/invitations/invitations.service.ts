import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
import { UserDocument } from '../users/schemas/user.schema';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto, InvitationQueryDto } from './dto/create-invitation.dto';
import { EntityType, Invitation, InvitationStatus } from './schemas/invitation.schema';
import { InvitationStrategyFactory } from './strategies/invitation-strategy.factory';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(Invitation.name)
    private readonly invitationModel: AppModel<Invitation>,
    private readonly caslAuthorizationService: CaslAuthorizationService,
    private readonly invitationStrategyFactory: InvitationStrategyFactory,
  ) {}

  async create(createInvitationDto: CreateInvitationDto, currentUser: UserDocument): Promise<Invitation> {
    // CASL: Check create permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Invitation)) {
      throw new ForbiddenException('You do not have permission to create invitations');
    }

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Cannot create invitation: No tenant context');
    }

    const landlordId = this.getLandlordId(currentUser);

    // Get appropriate strategy for validation
    const strategy = this.invitationStrategyFactory.getStrategy(createInvitationDto.entityType);

    // Validate entity-specific data
    await strategy.validateEntityData(createInvitationDto.entityData);

    // Check if invitation already exists for this email and entity type
    const existingInvitation = await this.invitationModel
      .byTenant(landlordId)
      .findOne({
        email: createInvitationDto.email.toLowerCase(),
        entityType: createInvitationDto.entityType,
        status: InvitationStatus.PENDING,
      })
      .exec();

    if (existingInvitation) {
      throw new UnprocessableEntityException(
        `A pending invitation already exists for ${createInvitationDto.email} as ${createInvitationDto.entityType}`,
      );
    }

    // Generate secure invitation token
    const invitationToken = this.generateInvitationToken();

    // Create invitation
    const invitationData = {
      tenantId: landlordId,
      invitedBy: currentUser._id,
      entityType: createInvitationDto.entityType,
      email: createInvitationDto.email.toLowerCase(),
      entityData: createInvitationDto.entityData || {},
      invitationToken,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    };

    const InvitationWithTenant = this.invitationModel.byTenant(landlordId);
    const newInvitation = new InvitationWithTenant(invitationData);

    // Validate using strategy before saving
    await strategy.validateInvitationData(newInvitation);

    const savedInvitation = await newInvitation.save();

    // todo send invitation
    return savedInvitation;
  }

  async findAllPaginated(
    queryDto: InvitationQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<Invitation>> {
    // CASL: Check read permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Invitation)) {
      throw new ForbiddenException('You do not have permission to view invitations');
    }

    // Ensure user has tenant context
    if (!currentUser.tenantId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const landlordId = this.getLandlordId(currentUser);
    const { page = 1, limit = 10, search, entityType, status, sortBy = 'createdAt', sortOrder = 'desc' } = queryDto;

    let baseQuery = this.invitationModel.byTenant(landlordId).find();

    // Apply CASL field-level filtering
    baseQuery = (baseQuery as any).accessibleBy(ability, Action.Read);

    // Add search functionality
    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { email: { $regex: search, $options: 'i' } },
          { 'entityData.name': { $regex: search, $options: 'i' } },
        ],
      });
    }

    // Filter by entity type
    if (entityType) {
      baseQuery = baseQuery.where({ entityType });
    }

    // Filter by status
    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    // Build sort object
    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries
    const [invitations, total] = await Promise.all([
      baseQuery.clone().sort(sortObj).skip(skip).limit(limit).exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse<Invitation>(invitations, total, page, limit);
  }

  async findByToken(token: string): Promise<Invitation> {
    // First check if token exists at all
    const anyInvitation = await this.invitationModel
      .findOne({ invitationToken: token })
      .exec();

    if (!anyInvitation) {
      throw new NotFoundException('Invitation token not found');
    }

    // Check if invitation is in pending status
    if (anyInvitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation is no longer available. Status: ${anyInvitation.status}`,
      );
    }

    // Check if invitation has expired
    if (anyInvitation.expiresAt <= new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    return anyInvitation;
  }

  async acceptInvitation(token: string, acceptInvitationDto: AcceptInvitationDto): Promise<any> {


    // Find invitation by token (this will throw NotFoundException if not found/invalid)
    const invitation = await this.findByToken(token);

    // Get appropriate strategy
    const strategy = this.invitationStrategyFactory.getStrategy(invitation.entityType);

    // Create the entity using the strategy
    const createdEntity = await strategy.createEntity(invitation, acceptInvitationDto);

    // Mark invitation as accepted
    invitation.status = InvitationStatus.ACCEPTED;
    invitation.acceptedAt = new Date();
    await invitation.save();

    return {
      success: true,
      entityType: invitation.entityType,
      entity: createdEntity,
      message: `${invitation.entityType} account created successfully`,
    };
  }

  async revokeInvitation(id: string, currentUser: UserDocument): Promise<void> {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Update, Invitation)) {
      throw new ForbiddenException('You do not have permission to revoke invitations');
    }

    const landlordId = this.getLandlordId(currentUser);

    const invitation = await this.invitationModel.byTenant(landlordId).findById(id).exec();

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('Only pending invitations can be revoked');
    }

    invitation.status = InvitationStatus.REVOKED;
    await invitation.save();
  }

  async deleteInvitation(id: string, currentUser: UserDocument): Promise<void> {
    // CASL: Check delete permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Delete, Invitation)) {
      throw new ForbiddenException('You do not have permission to delete invitations');
    }

    const landlordId = this.getLandlordId(currentUser);

    const invitation = await this.invitationModel.byTenant(landlordId).findById(id).exec();

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    await this.invitationModel.deleteById(id);
  }

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private getLandlordId(currentUser: UserDocument) {
    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : currentUser.tenantId;
  }
}