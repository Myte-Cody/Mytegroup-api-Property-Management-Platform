import { Injectable } from '@nestjs/common';
import { Payment } from '../../../features/leases/schemas/payment.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadPaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, payment?: Payment): boolean {
    if (payment) {
      return ability.can(Action.Read, payment);
    }
    return ability.can(Action.Read, Payment);
  }
}

@Injectable()
export class ManagePaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, payment?: Payment): boolean {
    if (payment) {
      return ability.can(Action.Manage, payment);
    }
    return ability.can(Action.Manage, Payment);
  }
}

@Injectable()
export class CreatePaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Payment);
  }
}

@Injectable()
export class UpdatePaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, payment?: Payment): boolean {
    if (payment) {
      return ability.can(Action.Update, payment);
    }
    return ability.can(Action.Update, Payment);
  }
}

@Injectable()
export class DeletePaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, payment?: Payment): boolean {
    if (payment) {
      return ability.can(Action.Delete, payment);
    }
    return ability.can(Action.Delete, Payment);
  }
}

@Injectable()
export class SubmitPaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, payment?: Payment): boolean {
    if (payment) {
      return ability.can(Action.Update, payment);
    }
    return ability.can(Action.Update, Payment);
  }
}

@Injectable()
export class ValidatePaymentPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, payment?: Payment): boolean {
    if (payment) {
      return ability.can(Action.Update, payment);
    }
    return ability.can(Action.Update, Payment);
  }
}
