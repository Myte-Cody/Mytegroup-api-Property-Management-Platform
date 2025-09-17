import { Injectable } from '@nestjs/common';
import { RentalPeriod } from '../../../features/leases/schemas/rental-period.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { Action, AppAbility } from '../casl-ability.factory';
import { IPolicyHandler } from '../guards/casl.guard';

@Injectable()
export class ReadRentalPeriodPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, rentalPeriod?: RentalPeriod): boolean {
    if (rentalPeriod) {
      return ability.can(Action.Read, rentalPeriod);
    }
    return ability.can(Action.Read, RentalPeriod);
  }
}

@Injectable()
export class ManageRentalPeriodPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, rentalPeriod?: RentalPeriod): boolean {
    if (rentalPeriod) {
      return ability.can(Action.Manage, rentalPeriod);
    }
    return ability.can(Action.Manage, RentalPeriod);
  }
}

@Injectable()
export class CreateRentalPeriodPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return ability.can(Action.Create, RentalPeriod);
  }
}

@Injectable()
export class UpdateRentalPeriodPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, rentalPeriod?: RentalPeriod): boolean {
    if (rentalPeriod) {
      return ability.can(Action.Update, rentalPeriod);
    }
    return ability.can(Action.Update, RentalPeriod);
  }
}

@Injectable()
export class DeleteRentalPeriodPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User, rentalPeriod?: RentalPeriod): boolean {
    if (rentalPeriod) {
      return ability.can(Action.Delete, rentalPeriod);
    }
    return ability.can(Action.Delete, RentalPeriod);
  }
}