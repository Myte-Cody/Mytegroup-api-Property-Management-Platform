import { Injectable } from '@nestjs/common';
import { Organization } from '../../../features/organizations/schemas/organization.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { AppAbility, CaslAbilityFactory } from '../casl-ability.factory';

@Injectable()
export class CaslAuthorizationService {
  constructor(private caslAbilityFactory: CaslAbilityFactory) {}

  /**
   * Create ability instance for a user
   */
  createAbilityForUser(user: User & { organization: Organization; isAdmin?: boolean }): AppAbility {
    return this.caslAbilityFactory.createForUser(user);
  }
}
