import { Injectable } from '@nestjs/common';
import { Organization } from '../../../features/organizations/schemas/organization.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadOrganizationPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, organization?: Organization): boolean {
    if (organization) {
      return ability.can(Action.Read, organization);
    }
    return ability.can(Action.Read, Organization);
  }
}

@Injectable()
export class ManageOrganizationPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, organization?: Organization): boolean {
    if (organization) {
      return ability.can(Action.Manage, organization);
    }
    return ability.can(Action.Manage, Organization);
  }
}

@Injectable()
export class UpdateOrganizationPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, organization?: Organization): boolean {
    if (organization) {
      return ability.can(Action.Update, organization);
    }
    return ability.can(Action.Update, Organization);
  }
}

@Injectable()
export class DeleteOrganizationPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, organization?: Organization): boolean {
    if (organization) {
      return ability.can(Action.Delete, organization);
    }
    return ability.can(Action.Delete, Organization);
  }
}

@Injectable()
export class CreateOrganizationPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Organization);
  }
}
