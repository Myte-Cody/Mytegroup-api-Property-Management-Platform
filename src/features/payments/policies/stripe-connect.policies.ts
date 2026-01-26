import { Injectable } from '@nestjs/common';
import { AppAbility } from '../../../common/casl/casl-ability.factory';
import { IPolicyHandler } from '../../../common/casl/guards/casl.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { UserType } from '../../../common/enums/user-type.enum';
import { User } from '../../users/schemas/user.schema';

/**
 * Policy handler for managing Stripe Connect - only Landlord Admins can connect/disconnect accounts
 */
@Injectable()
export class ManageStripeConnectPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    // Only landlord admins can manage Stripe Connect
    if (user.user_type !== UserType.LANDLORD) {
      return false;
    }

    // Check if user is primary (admin) or has explicit admin role
    if (user.role === UserRole.LANDLORD_ADMIN || user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // If no explicit role, check isPrimary flag
    return user.isPrimary === true;
  }
}

/**
 * Policy handler for viewing Stripe Connect status - any landlord user can view
 */
@Injectable()
export class ReadStripeConnectPolicyHandler implements IPolicyHandler {
  handle(ability: AppAbility, user: User): boolean {
    return user.user_type === UserType.LANDLORD;
  }
}
