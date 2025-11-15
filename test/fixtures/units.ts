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
};

export const testUnit2 = {
  unitNumber: '102',
  size: 800,
  type: UnitType.STUDIO,
  availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
};

export const testUnit3 = {
  unitNumber: '103',
  size: 1500,
  type: UnitType.APARTMENT,
  availabilityStatus: UnitAvailabilityStatus.AVAILABLE_FOR_RENT,
};

export const createTestUnit = (timestamp: number) => ({
  unitNumber: `${timestamp}-101`,
  size: 1000,
  type: UnitType.APARTMENT,
  availabilityStatus: UnitAvailabilityStatus.VACANT,
});
