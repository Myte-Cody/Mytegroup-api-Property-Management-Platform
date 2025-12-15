import { Injectable } from '@nestjs/common';
import { VisitRequest } from '../../../features/maintenance/schemas/visit-request.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadVisitRequestPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, visitRequest?: VisitRequest): boolean {
    if (visitRequest) {
      return ability.can(Action.Read, visitRequest);
    }
    return ability.can(Action.Read, VisitRequest);
  }
}

@Injectable()
export class CreateVisitRequestPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, VisitRequest);
  }
}

@Injectable()
export class UpdateVisitRequestPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, visitRequest?: VisitRequest): boolean {
    if (visitRequest) {
      return ability.can(Action.Update, visitRequest);
    }
    return ability.can(Action.Update, VisitRequest);
  }
}

@Injectable()
export class DeleteVisitRequestPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, visitRequest?: VisitRequest): boolean {
    if (visitRequest) {
      return ability.can(Action.Delete, visitRequest);
    }
    return ability.can(Action.Delete, VisitRequest);
  }
}
