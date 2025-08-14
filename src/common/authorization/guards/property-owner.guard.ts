import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Property } from '../../../features/properties/schemas/property.schema';
import { User } from '../../../features/users/schemas/user.schema';
import { PROPERTY_OWNER_KEY } from '../decorators/property-owner.decorator';

@Injectable()
export class PropertyOwnerGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectModel(Property.name) private readonly propertyModel: Model<Property>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const propertyOwnerKey = this.reflector.getAllAndOverride<string>(PROPERTY_OWNER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // If property ownership check is not required, allow access
    if (!propertyOwnerKey) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: Partial<User> = request.user;
    if (!user) {
      return false;
    }

    let propertyId = request.params[propertyOwnerKey];

    if (!propertyId && request.body && request.body.property) {
      propertyId = request.body.property;
    }

    // If no property ID is found, deny access
    if (!propertyId) {
      throw new ForbiddenException('Property ID not found in request');
    }

    // Get the user's organization ID
    const organizationId = user.organization._id;

    // If the user has no organization, deny access
    if (!organizationId) {
      return false;
    }
    // Check if the property belongs to the user's organization
    const property = await this.propertyModel.findById(propertyId).exec();
    if (property?.owner?.toString() !== organizationId.toString()) {
      return false;
    }

    return true;
  }
}
