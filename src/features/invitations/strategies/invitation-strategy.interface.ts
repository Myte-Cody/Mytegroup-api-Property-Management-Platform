import { UserDocument } from '../../users/schemas/user.schema';
import { AcceptInvitationDto } from '../dto/accept-invitation.dto';
import { Invitation } from '../schemas/invitation.schema';

export interface IInvitationStrategy {
  /**
   * Validates the entity-specific data before creating an invitation
   */
  validateEntityData(entityData: any): Promise<void>;

  /**
   * Creates the actual entity and user account when invitation is accepted
   */
  createEntity(
    invitation: Invitation,
    acceptInvitationDto: AcceptInvitationDto,
    currentUser?: UserDocument,
  ): Promise<any>;

  /**
   * Validates that the invitation data is complete for this entity type
   */
  validateInvitationData(invitation: Invitation): Promise<void>;
}
