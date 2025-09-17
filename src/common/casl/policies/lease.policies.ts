import { Injectable } from '@nestjs/common';
import { Lease } from '../../../features/leases/schemas/lease.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadLeasePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, lease?: Lease): boolean {
    if (lease) {
      return ability.can(Action.Read, lease);
    }
    return ability.can(Action.Read, Lease);
  }
}

@Injectable()
export class ManageLeasePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, lease?: Lease): boolean {
    if (lease) {
      return ability.can(Action.Manage, lease);
    }
    return ability.can(Action.Manage, Lease);
  }
}

@Injectable()
export class CreateLeasePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Lease);
  }
}

@Injectable()
export class UpdateLeasePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, lease?: Lease): boolean {
    if (lease) {
      return ability.can(Action.Update, lease);
    }
    return ability.can(Action.Update, Lease);
  }
}

@Injectable()
export class DeleteLeasePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, lease?: Lease): boolean {
    if (lease) {
      return ability.can(Action.Delete, lease);
    }
    return ability.can(Action.Delete, Lease);
  }
}