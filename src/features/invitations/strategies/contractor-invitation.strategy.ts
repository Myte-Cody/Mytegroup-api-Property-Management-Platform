import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { ContractorsService } from '../../contractors/contractors.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../schemas/invitation.schema';
import { IInvitationStrategy } from './invitation-strategy.interface';

@Injectable()
export class ContractorInvitationStrategy implements IInvitationStrategy {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly contractorsService: ContractorsService,
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
    // Validate that category is provided for contractor invitations
    if (!acceptInvitationDto.category) {
      throw new BadRequestException('Category is required for contractor invitations');
    }

    // Double-check email availability before creating the entity
    const existingUserWithEmail = await this.userModel
      .findOne({ email: invitation.email.toLowerCase() }, null, { session: session ?? null })
      .exec();

    if (existingUserWithEmail) {
      throw new UnprocessableEntityException(
        `The email '${invitation.email}' is already registered in your organization`,
      );
    }

    // Check if username is already taken
    const existingUserWithUsername = await this.userModel
      .findOne({ username: acceptInvitationDto.username.toLowerCase() }, null, {
        session: session ?? null,
      })
      .exec();

    if (existingUserWithUsername) {
      throw new UnprocessableEntityException(
        `The username '${acceptInvitationDto.username}' is already taken in your organization`,
      );
    }

    // We'll need proper dependency injection in the actual implementation
    const createContractorDto = {
      name: acceptInvitationDto.name,
      email: invitation.email,
      password: acceptInvitationDto.password,
      phone: acceptInvitationDto.phone,
      username: acceptInvitationDto.username,
      firstName: acceptInvitationDto.firstName,
      lastName: acceptInvitationDto.lastName,
      category: acceptInvitationDto.category,
    };

    // This would be called through proper DI
    return await this.contractorsService.createFromInvitation(createContractorDto, session);
  }
}
