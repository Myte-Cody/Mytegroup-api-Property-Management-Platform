import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession } from 'mongoose';
import { UserType } from '../../../common/enums/user-type.enum';
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
    // Validate that landlordId is provided (required for contractor invitations)
    if (!entityData?.landlordId) {
      throw new UnprocessableEntityException('Landlord ID is required for contractor invitations');
    }
    return;
  }

  async validateInvitationData(invitation: Invitation): Promise<void> {
    // Check if email is already registered as a CONTRACTOR user
    const existingContractorUser = await this.userModel
      .findOne({
        email: invitation.email.toLowerCase(),
        user_type: UserType.CONTRACTOR,
      })
      .exec();

    // If user already exists as contractor, check if they're already invited by this landlord
    if (existingContractorUser && existingContractorUser.organization_id) {
      const existingContractor = await this.contractorsService.findContractorByUserEmail(
        invitation.email,
      );
      const landlordId = invitation.entityData?.landlordId;

      if (existingContractor && landlordId) {
        const alreadyAssociated = existingContractor.landlords?.some(
          (id) => id.toString() === landlordId,
        );
        if (alreadyAssociated) {
          throw new UnprocessableEntityException(
            `This contractor is already associated with your organization`,
          );
        }
      }
      // User exists but not associated - this is allowed, will add landlord on accept
    }

    // Check if email is registered as a different user type (Landlord, Tenant, Admin)
    const existingOtherUser = await this.userModel
      .findOne({
        email: invitation.email.toLowerCase(),
        user_type: { $ne: UserType.CONTRACTOR },
      })
      .exec();

    if (existingOtherUser) {
      throw new UnprocessableEntityException(
        `The email '${invitation.email}' is already registered as a ${existingOtherUser.user_type}`,
      );
    }
  }

  async checkExistingUser(email: string): Promise<{ exists: boolean; contractorId?: string }> {
    const existingContractorUser = await this.userModel
      .findOne({
        email: email.toLowerCase(),
        user_type: UserType.CONTRACTOR,
      })
      .exec();

    if (existingContractorUser && existingContractorUser.organization_id) {
      return {
        exists: true,
        contractorId: existingContractorUser.organization_id.toString(),
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

    // Check if contractor already exists
    const existingCheck = await this.checkExistingUser(invitation.email);

    if (existingCheck.exists && existingCheck.contractorId) {
      // Contractor already exists - just add landlord to their landlords array
      await this.contractorsService.addLandlordToContractor(
        existingCheck.contractorId,
        landlordId,
        session,
      );
      return {
        _id: existingCheck.contractorId,
        existingUser: true,
        message: 'Landlord added to existing contractor',
      };
    }

    // Validate that category is provided for new contractor invitations
    if (!acceptInvitationDto.category) {
      throw new BadRequestException('Category is required for contractor invitations');
    }

    // Check if username is already taken
    const existingUserWithUsername = await this.userModel
      .findOne({ username: acceptInvitationDto.username.toLowerCase() }, null, {
        session: session ?? null,
      })
      .exec();

    if (existingUserWithUsername) {
      throw new UnprocessableEntityException(
        `The username '${acceptInvitationDto.username}' is already taken`,
      );
    }

    // Create new contractor with landlord ID
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

    return await this.contractorsService.createFromInvitation(
      createContractorDto,
      landlordId,
      session,
    );
  }
}
