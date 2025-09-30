import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../schemas/invitation.schema';
import { IInvitationStrategy } from './invitation-strategy.interface';

@Injectable()
export class ContractorInvitationStrategy implements IInvitationStrategy {
  constructor(
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
  ) {}

  async validateEntityData(entityData: any): Promise<void> {
    if (!entityData.name || typeof entityData.name !== 'string') {
      throw new UnprocessableEntityException('Contractor name is required');
    }

    if (entityData.name.length < 2 || entityData.name.length > 100) {
      throw new UnprocessableEntityException(
        'Contractor name must be between 2 and 100 characters',
      );
    }

    // Validate specialization if provided
    if (entityData.specialization && typeof entityData.specialization !== 'string') {
      throw new UnprocessableEntityException('Specialization must be a string');
    }
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

    // Import ContractorsService dynamically to avoid circular dependencies
    const { ContractorsService } = await import('../../contractors/contractors.service');

    // We'll need proper dependency injection in the actual implementation
    const createContractorDto = {
      name: invitation.entityData.name,
      email: invitation.email,
      password: acceptInvitationDto.password,
      phoneNumber: acceptInvitationDto.phoneNumber,
      specialization: invitation.entityData.specialization,
    };

    // This would be called through proper DI
    // return await contractorsService.create(createContractorDto, currentUser);

    // Placeholder return
    return {
      success: true,
      entityType: 'contractor',
      entityData: createContractorDto,
    };
  }
}
