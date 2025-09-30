import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { TenantsService } from '../../tenants/tenants.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../schemas/invitation.schema';
import { IInvitationStrategy } from './invitation-strategy.interface';

@Injectable()
export class TenantInvitationStrategy implements IInvitationStrategy {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly usersService: UsersService,
    private readonly tenantsService: TenantsService,
  ) {}

  async validateEntityData(entityData: any): Promise<void> {
    // No validation needed for tenant invitations since the invitee will provide their name
    return;
  }

  async validateInvitationData(invitation: Invitation): Promise<void> {
    // Check if email is already registered by any user
    const existingUserWithEmail = await this.userModel
      .findOne({ email: invitation.email.toLowerCase() })
      .exec();

    if (existingUserWithEmail) {
      throw new UnprocessableEntityException(
        `The email '${invitation.email}' is already registered in your organization`,
      );
    }
  }

  async createEntity(
    invitation: Invitation,
    acceptInvitationDto: AcceptInvitationDto,
    currentUser?: UserDocument,
    session?: ClientSession,
  ): Promise<any> {
    const createTenantDto = {
      name: acceptInvitationDto.name,
      email: invitation.email,
      username: acceptInvitationDto.username,
      password: acceptInvitationDto.password,
      phoneNumber: acceptInvitationDto.phoneNumber,
    };

    // Create tenant using the invitation-specific method that doesn't require CASL authorization
    return await this.tenantsService.createFromInvitation(createTenantDto, session);
  }
}
