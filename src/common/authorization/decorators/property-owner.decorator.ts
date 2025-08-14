import { SetMetadata } from '@nestjs/common';

export const PROPERTY_OWNER_KEY = 'propertyOwner';
export const PROPERTY_PARAM_KEY = 'propertyParamKey';

/**
 * Decorator to check if the user's organization owns the property
 * @param propertyParamKey The parameter name that contains the property ID in the request
 */
export const PropertyOwner = (propertyParamKey: string = 'id') => {
  return SetMetadata(PROPERTY_OWNER_KEY, true) && SetMetadata(PROPERTY_PARAM_KEY, propertyParamKey);
};
