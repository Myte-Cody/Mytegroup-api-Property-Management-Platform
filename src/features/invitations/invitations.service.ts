import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import { ClientSession } from 'mongoose';
import { Action } from '../../common/casl/casl-ability.factory';
import { CaslAuthorizationService } from '../../common/casl/services/casl-authorization.service';
import { AppModel } from '../../common/interfaces/app-model.interface';
import { SessionService } from '../../common/services/session.service';
import { createPaginatedResponse, PaginatedResponse } from '../../common/utils/pagination.utils';
import { InvitationEmailService } from '../email/services/invitation-email.service';
import type { UserDocument } from '../users/schemas/user.schema';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { InvitationQueryDto } from './dto/invitation-query.dto';
import { EntityType, Invitation, InvitationStatus } from './schemas/invitation.schema';
import { InvitationStrategyFactory } from './strategies/invitation-strategy.factory';

@Injectable()
export class InvitationsService {
  constructor(
    @InjectModel(Invitation.name)
    private readonly invitationModel: AppModel<Invitation>,
    private readonly caslAuthorizationService: CaslAuthorizationService,
    private readonly invitationStrategyFactory: InvitationStrategyFactory,
    private readonly invitationEmailService: InvitationEmailService,
    private readonly sessionService: SessionService,
  ) {}

  async create(
    createInvitationDto: CreateInvitationDto,
    currentUser: UserDocument,
  ): Promise<Invitation> {
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Create, Invitation)) {
      throw new ForbiddenException('You do not have permission to create invitations');
    }

    const strategy = this.invitationStrategyFactory.getStrategy(createInvitationDto.entityType);
    const normalizedEmail = createInvitationDto.email.toLowerCase();
    const entityData = {
      ...(createInvitationDto.entityData || {}),
    };

    // Automatically add landlord ID for tenant and contractor invitations
    if (
      (createInvitationDto.entityType === EntityType.TENANT ||
        createInvitationDto.entityType === EntityType.CONTRACTOR) &&
      currentUser.organization_id
    ) {
      entityData.landlordId = entityData.landlordId || currentUser.organization_id.toString();
    }

    if (
      createInvitationDto.entityType === EntityType.LANDLORD_STAFF &&
      currentUser.organization_id
    ) {
      entityData.organizationId =
        entityData.organizationId || currentUser.organization_id.toString();
    }

    await strategy.validateEntityData(entityData);

    const existingInvitation = await this.invitationModel
      .findOne({
        email: normalizedEmail,
        entityType: createInvitationDto.entityType,
        status: InvitationStatus.PENDING,
      })
      .exec();

    if (existingInvitation) {
      throw new UnprocessableEntityException(
        `A pending invitation already exists for ${createInvitationDto.email} as ${createInvitationDto.entityType}`,
      );
    }

    const invitationToken = this.generateInvitationToken();

    // Create invitation
    const invitationData = {
      invitedBy: currentUser._id,
      entityType: createInvitationDto.entityType,
      email: createInvitationDto.email.toLowerCase(),
      entityData,
      invitationToken,
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    };

    const newInvitation = new this.invitationModel(invitationData);

    await strategy.validateInvitationData(newInvitation);

    const savedInvitation = await newInvitation.save();

    // Send invitation email
    try {
      // Additional info based on entity type
      let additionalInfo;
      if (createInvitationDto.entityType === EntityType.TENANT) {
        additionalInfo = 'You will have access to property management features';
      } else if (createInvitationDto.entityType === EntityType.CONTRACTOR) {
        additionalInfo = 'You will have access to maintenance and service features';
      } else if (createInvitationDto.entityType === EntityType.LANDLORD_STAFF) {
        additionalInfo = 'You have been invited to help manage the landlord workspace.';
      }

      await this.invitationEmailService.sendInvitationEmail(
        savedInvitation.email,
        savedInvitation.invitationToken,
        savedInvitation.entityType,
        savedInvitation.expiresAt,
        {
          additionalInfo,
          queue: true, // Use queue for background processing
          metadata: savedInvitation.entityData,
        },
      );
    } catch (error) {
      // Log error but don't fail the invitation creation if email sending fails
      console.error('Failed to send invitation email:', error);
    }

    return savedInvitation;
  }

  async findAllPaginated(
    queryDto: InvitationQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedResponse<Invitation>> {
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Read, Invitation)) {
      throw new ForbiddenException('You do not have permission to view invitations');
    }

    const {
      page = 1,
      limit = 10,
      search,
      entityType,
      status,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    let baseQuery = this.invitationModel.find();

    baseQuery = (baseQuery as any).accessibleBy(ability, Action.Read);

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

  async findByToken(
    token: string,
  ): Promise<{ invitation: Invitation; existingUser: boolean; requiresForm: boolean }> {
    const anyInvitation = await this.invitationModel.findOne({ invitationToken: token }).exec();

    if (!anyInvitation) {
      throw new NotFoundException('Invitation token not found');
    }

    if (anyInvitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException(
        `Invitation is no longer available. Status: ${anyInvitation.status}`,
      );
    }

    if (anyInvitation.expiresAt <= new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    // Check if user already exists based on entity type
    const strategy = this.invitationStrategyFactory.getStrategy(anyInvitation.entityType);
    let existingUser = false;

    if ('checkExistingUser' in strategy && typeof strategy.checkExistingUser === 'function') {
      const existingCheck = await strategy.checkExistingUser(anyInvitation.email);
      existingUser = existingCheck.exists;
    }

    return {
      invitation: anyInvitation,
      existingUser,
      requiresForm: !existingUser, // If user doesn't exist, they need to fill out the form
    };
  }

  async acceptInvitation(token: string, acceptInvitationDto: AcceptInvitationDto): Promise<any> {
    const { invitation, existingUser } = await this.findByToken(token);

    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }

    return await this.sessionService.withSession(async (session: ClientSession | null) => {
      const strategy = this.invitationStrategyFactory.getStrategy(invitation.entityType);

      // createEntity handles both cases:
      // - For existing users: adds landlord to their landlords array
      // - For new users: creates entity and user account with landlord
      const result = await strategy.createEntity(invitation, acceptInvitationDto, null, session);

      // Mark invitation as accepted
      invitation.status = InvitationStatus.ACCEPTED;
      invitation.acceptedAt = new Date();
      await invitation.save({ session });

      return {
        success: true,
        entityType: invitation.entityType,
        entity: result,
        existingUser: result?.existingUser || existingUser,
        message: existingUser
          ? `Landlord added to your existing ${invitation.entityType} account`
          : `${invitation.entityType} account created successfully`,
      };
    });
  }

  async revokeInvitation(id: string, currentUser: UserDocument): Promise<void> {
    // CASL: Check update permission
    const ability = this.caslAuthorizationService.createAbilityForUser(currentUser);

    if (!ability.can(Action.Update, Invitation)) {
      throw new ForbiddenException('You do not have permission to revoke invitations');
    }

    const invitation = await this.invitationModel.findById(id).exec();

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

    const invitation = await this.invitationModel.findById(id).exec();

    if (!invitation) {
      throw new NotFoundException(`Invitation with ID ${id} not found`);
    }

    await this.invitationModel.deleteById(id);
  }

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
