import { Injectable } from '@nestjs/common';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadUserPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, targetUser?: User): boolean {
    if (targetUser) {
      return ability.can(Action.Read, targetUser);
    }
    return ability.can(Action.Read, User);
  }
}

@Injectable()
export class ManageUserPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, targetUser?: User): boolean {
    if (targetUser) {
      return ability.can(Action.Manage, targetUser);
    }
    return ability.can(Action.Manage, User);
  }
}

@Injectable()
export class CreateUserPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, context?: any): boolean {
    // Check if user has basic create permission
    const canCreate = ability.can(Action.Create, User);

    if (!canCreate) return false;

    return true;
  }
}

@Injectable()
export class UpdateUserPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, targetUser?: User): boolean {
    if (targetUser) {
      return ability.can(Action.Update, targetUser);
    }
    return ability.can(Action.Update, User);
  }
}

@Injectable()
export class DeleteUserPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, targetUser?: User): boolean {
    if (targetUser) {
      return ability.can(Action.Delete, targetUser);
    }
    return ability.can(Action.Delete, User);
  }
}
