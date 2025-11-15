import { Injectable } from '@nestjs/common';
import { Transaction } from '../../../features/leases/schemas/transaction.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, transaction?: Transaction): boolean {
    if (transaction) {
      return ability.can(Action.Read, transaction);
    }
    return ability.can(Action.Read, Transaction);
  }
}

@Injectable()
export class ManageTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, transaction?: Transaction): boolean {
    if (transaction) {
      return ability.can(Action.Manage, transaction);
    }
    return ability.can(Action.Manage, Transaction);
  }
}

@Injectable()
export class CreateTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Transaction);
  }
}

@Injectable()
export class UpdateTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, transaction?: Transaction): boolean {
    if (transaction) {
      return ability.can(Action.Update, transaction);
    }
    return ability.can(Action.Update, Transaction);
  }
}

@Injectable()
export class DeleteTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, transaction?: Transaction): boolean {
    if (transaction) {
      return ability.can(Action.Delete, transaction);
    }
    return ability.can(Action.Delete, Transaction);
  }
}

@Injectable()
export class SubmitTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, transaction?: Transaction): boolean {
    if (transaction) {
      return ability.can(Action.Update, transaction);
    }
    return ability.can(Action.Update, Transaction);
  }
}

@Injectable()
export class ValidateTransactionPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, transaction?: Transaction): boolean {
    if (transaction) {
      return ability.can(Action.Update, transaction);
    }
    return ability.can(Action.Update, Transaction);
  }
}
