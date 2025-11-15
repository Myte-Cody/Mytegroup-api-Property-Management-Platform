import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { UserType } from '../../../common/enums/user-type.enum';
import { UserRole } from '../../../common/enums/user-role.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { CreateUserDto } from '../../users/dto/create-user.dto';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UsersService } from '../../users/users.service';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../schemas/invitation.schema';
import { IInvitationStrategy } from './invitation-strategy.interface';

@Injectable()
export class LandlordStaffInvitationStrategy implements IInvitationStrategy {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly usersService: UsersService,
  ) {}

  async validateEntityData(entityData: any): Promise<void> {
    if (!entityData || !entityData.organizationId) {
      throw new BadRequestException('Staff invitations must include an organizationId');
    }
  }

  async validateInvitationData(invitation: Invitation): Promise<void> {
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
  ): Promise<UserDocument> {
    const organizationIdRaw = invitation.entityData?.organizationId;
    const organizationId =
      typeof organizationIdRaw === 'string'
        ? organizationIdRaw
        : organizationIdRaw?.toString?.();
    if (!organizationId) {
      throw new BadRequestException('Invitation is missing organization context');
    }

    const existingUserWithUsername = await this.userModel
      .findOne(
        { username: acceptInvitationDto.username.toLowerCase() },
        null,
        { session: session ?? null },
      )
      .exec();

    if (existingUserWithUsername) {
      throw new UnprocessableEntityException(
        `The username '${acceptInvitationDto.username}' is already taken`,
      );
    }

    const userPayload: CreateUserDto = {
      username: acceptInvitationDto.username,
      firstName: acceptInvitationDto.firstName,
      lastName: acceptInvitationDto.lastName,
      email: invitation.email,
      phone: acceptInvitationDto.phone,
      password: acceptInvitationDto.password,
      user_type: UserType.LANDLORD,
      organization_id: organizationId,
      isPrimary: false,
      role: UserRole.LANDLORD_STAFF,
    };

    return (await this.usersService.createFromInvitation(userPayload, session)) as unknown as UserDocument;
  }
}
