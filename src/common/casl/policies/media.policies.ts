import { IPolicyHandler } from '../guards/casl.guard';
import { Action } from '../casl-ability.factory';
import { Media } from '../../../features/media/schemas/media.schema';

export class CreateMediaPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Create, Media);
  }
}

export class ReadMediaPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Read, Media);
  }
}

export class UpdateMediaPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Update, Media);
  }
}

export class DeleteMediaPolicyHandler implements IPolicyHandler {
  handle(ability: any): boolean {
    return ability.can(Action.Delete, Media);
  }
}
