import { SetMetadata } from '@nestjs/common';
import { OrganizationType } from '../../enums/organization.enum';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which organization types can access an endpoint
 * @param roles Array of organization types that are allowed to access the endpoint
 */
export const Roles = (...roles: OrganizationType[]) => SetMetadata(ROLES_KEY, roles);
