import { Tenant } from '../../../features/tenants/schema/tenant.schema';
import { Action } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

export class CreateTenantPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Create, Tenant);
  }
}

export class ReadTenantPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Read, Tenant);
  }
}

export class UpdateTenantPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Update, Tenant);
  }
}

export class DeleteTenantPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Delete, Tenant);
  }
}
