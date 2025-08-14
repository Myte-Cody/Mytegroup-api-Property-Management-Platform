import { SetMetadata } from '@nestjs/common';

export const PROPERTY_OWNER_KEY = 'propertyOwner';

/**
 * Decorator to check if the user's organization owns the property
 * @param propertyParamKey The parameter name that contains the property ID in the request
 */
export const PropertyOwner = (propertyParamKey: string = 'id') => {
  return SetMetadata(PROPERTY_OWNER_KEY, propertyParamKey);
};
