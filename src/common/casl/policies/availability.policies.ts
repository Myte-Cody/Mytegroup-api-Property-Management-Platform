import { Availability } from '../../../features/availability/schemas/availability.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from './policy-handler.interface';

export class CreateAvailabilityPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Create, Availability);
  }
}

export class ReadAvailabilityPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Read, Availability);
  }
}

export class UpdateAvailabilityPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Update, Availability);
  }
}

export class DeleteAvailabilityPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Delete, Availability);
  }
}
