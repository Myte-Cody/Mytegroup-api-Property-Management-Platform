import { Injectable } from '@nestjs/common';
import { ScopeOfWork } from '../../../features/maintenance/schemas/scope-of-work.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadScopeOfWorkPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, scopeOfWork?: ScopeOfWork): boolean {
    if (scopeOfWork) {
      return ability.can(Action.Read, scopeOfWork);
    }
    return ability.can(Action.Read, ScopeOfWork);
  }
}

@Injectable()
export class ManageScopeOfWorkPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, scopeOfWork?: ScopeOfWork): boolean {
    if (scopeOfWork) {
      return ability.can(Action.Manage, scopeOfWork);
    }
    return ability.can(Action.Manage, ScopeOfWork);
  }
}

@Injectable()
export class CreateScopeOfWorkPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, ScopeOfWork);
  }
}

@Injectable()
export class UpdateScopeOfWorkPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, scopeOfWork?: ScopeOfWork): boolean {
    if (scopeOfWork) {
      return ability.can(Action.Update, scopeOfWork);
    }
    return ability.can(Action.Update, ScopeOfWork);
  }
}

@Injectable()
export class DeleteScopeOfWorkPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, scopeOfWork?: ScopeOfWork): boolean {
    if (scopeOfWork) {
      return ability.can(Action.Delete, scopeOfWork);
    }
    return ability.can(Action.Delete, ScopeOfWork);
  }
}
