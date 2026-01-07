import { Injectable } from '@nestjs/common';
import { Task } from '../../../features/tasks/schemas/task.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadTaskPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, task?: Task): boolean {
    if (task) {
      return ability.can(Action.Read, task);
    }
    return ability.can(Action.Read, Task);
  }
}

@Injectable()
export class ManageTaskPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, task?: Task): boolean {
    if (task) {
      return ability.can(Action.Manage, task);
    }
    return ability.can(Action.Manage, Task);
  }
}

@Injectable()
export class CreateTaskPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, Task);
  }
}

@Injectable()
export class UpdateTaskPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, task?: Task): boolean {
    if (task) {
      return ability.can(Action.Update, task);
    }
    return ability.can(Action.Update, Task);
  }
}

@Injectable()
export class DeleteTaskPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, task?: Task): boolean {
    if (task) {
      return ability.can(Action.Delete, task);
    }
    return ability.can(Action.Delete, Task);
  }
}
