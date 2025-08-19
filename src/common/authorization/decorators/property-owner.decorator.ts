import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common';
import { PropertyOwnerGuard } from '../guards/property-owner.guard';

export const PROPERTY_OWNER_KEY = 'propertyOwner';

/**
 * Decorator to check if the user's organization owns the property
 * Automatically applies the PropertyOwnerGuard to enforce the check
 * @param propertyParamKey The parameter name that contains the property ID in the request
 */
export const PropertyOwner = (propertyParamKey: string = 'id') => {
  return applyDecorators(
    SetMetadata(PROPERTY_OWNER_KEY, propertyParamKey),
    UseGuards(PropertyOwnerGuard),
  );
};
