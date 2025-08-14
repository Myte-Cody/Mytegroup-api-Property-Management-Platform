import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PROPERTY_OWNER_KEY, PROPERTY_PARAM_KEY } from '../decorators/property-owner.decorator';
import { PropertyService } from '../services/property.service';
import { UserService } from '../services/user.service';

@Injectable()
export class PropertyOwnerGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userService: UserService,
    private propertyService: PropertyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const checkPropertyOwnership = this.reflector.getAllAndOverride<boolean>(PROPERTY_OWNER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If property ownership check is not required, allow access
    if (!checkPropertyOwnership) {
      return true;
    }

    const propertyParamKey =
      this.reflector.getAllAndOverride<string>(PROPERTY_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) || 'id';

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.userId) {
      return false;
    }

    let propertyId = request.params[propertyParamKey];

    if (!propertyId && request.body && request.body.property) {
      propertyId = request.body.property;
    }

    // If no property ID is found, deny access
    if (!propertyId) {
      throw new ForbiddenException('Property ID not found in request');
    }

    // Get the user's organization ID
    const organizationId = await this.userService.getUserOrganizationId(user.userId);

    // If the user has no organization, deny access
    if (!organizationId) {
      return false;
    }

    // Check if the property belongs to the user's organization
    const isOwner = await this.propertyService.isPropertyOwnedByOrganization(
      propertyId,
      organizationId,
    );

    if (!isOwner) {
      throw new ForbiddenException('You do not have permission to access this property');
    }

    return true;
  }
}
