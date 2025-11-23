import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { UserType } from '../../../common/enums/user-type.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { TenantsService } from '../../tenants/tenants.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../schemas/invitation.schema';
import { IInvitationStrategy } from './invitation-strategy.interface';

@Injectable()
export class TenantInvitationStrategy implements IInvitationStrategy {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly tenantsService: TenantsService,
  ) {}

  async validateEntityData(entityData: any): Promise<void> {
    // Validate that landlordId is provided (required for tenant invitations)
    if (!entityData?.landlordId) {
      throw new UnprocessableEntityException('Landlord ID is required for tenant invitations');
    }
    return;
  }

  async validateInvitationData(invitation: Invitation): Promise<void> {
    // Check if email is already registered as a TENANT user
    const existingTenantUser = await this.userModel
      .findOne({
        email: invitation.email.toLowerCase(),
        user_type: UserType.TENANT,
      })
      .exec();

    // If user already exists as tenant, check if they're already invited by this landlord
    if (existingTenantUser && existingTenantUser.organization_id) {
      const existingTenant = await this.tenantsService.findTenantByUserEmail(invitation.email);
      const landlordId = invitation.entityData?.landlordId;

      if (existingTenant && landlordId) {
        const alreadyAssociated = existingTenant.landlords?.some(
          (id) => id.toString() === landlordId,
        );
        if (alreadyAssociated) {
          throw new UnprocessableEntityException(
            `This tenant is already associated with your organization`,
          );
        }
      }
      // User exists but not associated - this is allowed, will add landlord on accept
    }

    // Check if email is registered as a different user type (Landlord, Contractor, Admin)
    const existingOtherUser = await this.userModel
      .findOne({
        email: invitation.email.toLowerCase(),
        user_type: { $ne: UserType.TENANT },
      })
      .exec();

    if (existingOtherUser) {
      throw new UnprocessableEntityException(
        `The email '${invitation.email}' is already registered as a ${existingOtherUser.user_type}`,
      );
    }
  }

  async checkExistingUser(email: string): Promise<{ exists: boolean; tenantId?: string }> {
    const existingTenantUser = await this.userModel
      .findOne({
        email: email.toLowerCase(),
        user_type: UserType.TENANT,
      })
      .exec();

    if (existingTenantUser && existingTenantUser.organization_id) {
      return {
        exists: true,
        tenantId: existingTenantUser.organization_id.toString(),
      };
    }

    return { exists: false };
  }

  async createEntity(
    invitation: Invitation,
    acceptInvitationDto: AcceptInvitationDto,
    currentUser?: UserDocument,
    session?: ClientSession,
  ): Promise<any> {
    const landlordId = invitation.entityData?.landlordId;

    // Check if tenant already exists
    const existingCheck = await this.checkExistingUser(invitation.email);

    if (existingCheck.exists && existingCheck.tenantId) {
      // Tenant already exists - just add landlord to their landlords array
      await this.tenantsService.addLandlordToTenant(existingCheck.tenantId, landlordId, session);
      return {
        _id: existingCheck.tenantId,
        existingUser: true,
        message: 'Landlord added to existing tenant',
      };
    }

    // Create new tenant with landlord ID
    const invitationContext = invitation.entityData || {};

    const createTenantDto = {
      name: acceptInvitationDto.name,
      email: invitation.email,
      username: acceptInvitationDto.username,
      firstName: acceptInvitationDto.firstName,
      lastName: acceptInvitationDto.lastName,
      password: acceptInvitationDto.password,
      phone: acceptInvitationDto.phone,
      invitationContext,
    };

    // Create tenant using the invitation-specific method with landlord ID
    return await this.tenantsService.createFromInvitation(createTenantDto, landlordId, session);
  }
}
