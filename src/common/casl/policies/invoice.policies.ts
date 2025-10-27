import { Injectable } from '@nestjs/common';
import { Invoice } from '../../../features/maintenance/schemas/invoice.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadInvoicePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, invoice?: Invoice): boolean {
    if (invoice) {
      return ability.can(Action.Read, invoice);
    }
    return ability.can(Action.Read, Invoice);
  }
}

@Injectable()
export class CreateInvoicePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Invoice);
  }
}

@Injectable()
export class UpdateInvoicePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, invoice?: Invoice): boolean {
    if (invoice) {
      return ability.can(Action.Update, invoice);
    }
    return ability.can(Action.Update, Invoice);
  }
}

@Injectable()
export class DeleteInvoicePolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, invoice?: Invoice): boolean {
    if (invoice) {
      return ability.can(Action.Delete, invoice);
    }
    return ability.can(Action.Delete, Invoice);
  }
}
