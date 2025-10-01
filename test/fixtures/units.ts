import { UnitAvailabilityStatus, UnitType } from '../../src/common/enums/unit.enum';

export const testPropertyForUnits = {
  name: 'Test Property For Units',
  street: '789 Unit Test St',
  city: 'Unit Test City',
  state: 'UT',
  postalCode: '54321',
  country: 'Unit Test Country',
  description: 'A test property specifically for unit tests',
};

export const testUnit = {
  unitNumber: '101',
  size: 1000,
  type: UnitType.APARTMENT,
  availabilityStatus: UnitAvailabilityStatus.VACANT,
  bedrooms: 2,
  bathrooms: 1,
  rentAmount: 1500,
  description: 'A test unit for E2E testing',
};

export const testUnit2 = {
  unitNumber: '102',
  size: 800,
  type: UnitType.STUDIO,
  availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
  bedrooms: 1,
  bathrooms: 1,
  rentAmount: 1200,
  description: 'Another test unit for E2E testing',
};

export const testUnit3 = {
  unitNumber: '103',
  size: 1500,
  type: UnitType.APARTMENT,
  availabilityStatus: UnitAvailabilityStatus.AVAILABLE_FOR_RENT,
  bedrooms: 3,
  bathrooms: 2,
  rentAmount: 2000,
  description: 'A third test unit for E2E testing',
};
