import { Injectable } from '@nestjs/common';
import { Unit } from '../../../features/properties/schemas/unit.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadUnitPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, unit?: Unit): boolean {
    if (unit) {
      return ability.can(Action.Read, unit);
    }
    return ability.can(Action.Read, Unit);
  }
}

@Injectable()
export class ManageUnitPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, unit?: Unit): boolean {
    if (unit) {
      return ability.can(Action.Manage, unit);
    }
    return ability.can(Action.Manage, Unit);
  }
}

@Injectable()
export class CreateUnitPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Unit);
  }
}

@Injectable()
export class UpdateUnitPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, unit?: Unit): boolean {
    if (unit) {
      return ability.can(Action.Update, unit);
    }
    return ability.can(Action.Update, Unit);
  }
}

@Injectable()
export class DeleteUnitPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, unit?: Unit): boolean {
    if (unit) {
      return ability.can(Action.Delete, unit);
    }
    return ability.can(Action.Delete, Unit);
  }
}
