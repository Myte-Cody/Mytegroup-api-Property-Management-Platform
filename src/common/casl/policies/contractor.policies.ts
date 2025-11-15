import { Contractor } from '../../../features/contractors/schema/contractor.schema';
import { Action } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

export class CreateContractorPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Create, Contractor);
  }
}

export class ReadContractorPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Read, Contractor);
  }
}

export class UpdateContractorPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Update, Contractor);
  }
}

export class DeleteContractorPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Delete, Contractor);
  }
}
