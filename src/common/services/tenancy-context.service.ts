import { ForbiddenException, Injectable } from '@nestjs/common';
import mongoose from 'mongoose';
import { UserDocument } from '../../features/users/schemas/user.schema';
import { UserRole } from '../enums/user-role.enum';

/**
 * Service to manage multi-tenancy context for landlord-scoped data isolation.
 *
 * This service extracts the landlord context from the current user and provides
 * methods to check user types for applying query scopes in services.
 */
@Injectable()
export class TenancyContextService {
  /**
   * Get the landlord ID from the current user's organization_id.
   *
   * @param user - The current authenticated user
   * @returns The landlord's ObjectId
   * @throws ForbiddenException if user is not a landlord
   */
  getLandlordContext(user: UserDocument): mongoose.Types.ObjectId {
    if (user.user_type !== 'Landlord') {
      throw new ForbiddenException('User is not a landlord');
    }

    if (!user.organization_id) {
      throw new ForbiddenException('User does not have an organization_id');
    }

    return user.organization_id;
  }

  /**
   * Check if the user is a landlord.
   *
   * @param user - The current authenticated user
   * @returns True if user type is Landlord
   */
  isLandlord(user: UserDocument): boolean {
    return user.user_type === 'Landlord';
  }

  /**
   * Check if the user is a SuperAdmin.
   * SuperAdmins can see all data across all landlords.
   *
   * @param user - The current authenticated user
   * @returns True if user role is SUPER_ADMIN
   */
  isSuperAdmin(user: UserDocument): boolean {
    return user.role === UserRole.SUPER_ADMIN;
  }

  /**
   * Check if the user is a tenant.
   *
   * @param user - The current authenticated user
   * @returns True if user type is Tenant
   */
  isTenant(user: UserDocument): boolean {
    return user.user_type === 'Tenant';
  }

  /**
   * Check if the user is a contractor.
   *
   * @param user - The current authenticated user
   * @returns True if user type is Contractor
   */
  isContractor(user: UserDocument): boolean {
    return user.user_type === 'Contractor';
  }
}
