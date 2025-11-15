import { Injectable } from '@nestjs/common';
import { Property } from '../../../features/properties/schemas/property.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadPropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, property?: Property): boolean {
    if (property) {
      return ability.can(Action.Read, property);
    }
    return ability.can(Action.Read, Property);
  }
}

@Injectable()
export class ManagePropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, property?: Property): boolean {
    if (property) {
      return ability.can(Action.Manage, property);
    }
    return ability.can(Action.Manage, Property);
  }
}

@Injectable()
export class CreatePropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Property);
  }
}

@Injectable()
export class UpdatePropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, property?: Property): boolean {
    if (property) {
      return ability.can(Action.Update, property);
    }
    return ability.can(Action.Update, Property);
  }
}

@Injectable()
export class DeletePropertyPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, property?: Property): boolean {
    if (property) {
      return ability.can(Action.Delete, property);
    }
    return ability.can(Action.Delete, Property);
  }
}
