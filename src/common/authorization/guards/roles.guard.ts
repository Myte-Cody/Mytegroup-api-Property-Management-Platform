import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationType } from '../../enums/organization.enum';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { OrganizationService } from '../services/organization.service';
import { UserService } from '../services/user.service';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
    private organizationService: OrganizationService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<OrganizationType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // todo shouldnt we start with this ?
    if (!user || !user.userId) {
      return false;
    }

    // todo can we get it from user object
    const organizationId = await this.userService.getUserOrganizationId(user.userId);

    if (!organizationId) {
      return false;
    }

    const organization = await this.organizationService.isLandlord(organizationId);

    // Check if the organization type is in the required roles
    // Currently only checking for LANDLORD as per requirements
    // todo if (requiredRoles.includes(user.organization.type)) {
    if (requiredRoles.includes(OrganizationType.LANDLORD)) {
      return organization;
    }

    return false;
  }
}
