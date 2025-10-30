import { Expense } from '../../../features/expenses/schemas/expense.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../policy-handler.interface';

export class CreateExpensePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Create, Expense);
  }
}

export class ReadExpensePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Read, Expense);
  }
}

export class UpdateExpensePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Update, Expense);
  }
}

export class DeleteExpensePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility) {
    return ability.can(Action.Delete, Expense);
  }
}
