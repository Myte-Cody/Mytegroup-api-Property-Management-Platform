import { Injectable } from '@nestjs/common';
import { MaintenanceTicket } from '../../../features/maintenance/schemas/maintenance-ticket.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadMaintenanceTicketPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, ticket?: MaintenanceTicket): boolean {
    if (ticket) {
      return ability.can(Action.Read, ticket);
    }
    return ability.can(Action.Read, MaintenanceTicket);
  }
}

@Injectable()
export class ManageMaintenanceTicketPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, ticket?: MaintenanceTicket): boolean {
    if (ticket) {
      return ability.can(Action.Manage, ticket);
    }
    return ability.can(Action.Manage, MaintenanceTicket);
  }
}

@Injectable()
export class CreateMaintenanceTicketPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, MaintenanceTicket);
  }
}

@Injectable()
export class UpdateMaintenanceTicketPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, ticket?: MaintenanceTicket): boolean {
    if (ticket) {
      return ability.can(Action.Update, ticket);
    }
    return ability.can(Action.Update, MaintenanceTicket);
  }
}

@Injectable()
export class DeleteMaintenanceTicketPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, ticket?: MaintenanceTicket): boolean {
    if (ticket) {
      return ability.can(Action.Delete, ticket);
    }
    return ability.can(Action.Delete, MaintenanceTicket);
  }
}
