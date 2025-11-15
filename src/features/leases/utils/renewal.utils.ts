import { RentIncreaseType } from '../../../common/enums/lease.enum';
import { addDaysToDate, addMonthsUTC, normalizeToDate } from '../../../common/utils/date.utils';
import { RenewalConfig } from '../../../config/renewal.config';
import { Lease } from '../schemas/lease.schema';

export const normalizeToUTCStartOfDay = normalizeToDate;

export interface RentIncreaseCalculation {
  newRentAmount: number;
  rentIncrease: {
    type: RentIncreaseType;
    amount: number;
    reason?: string;
  } | null;
}

export interface RenewalDates {
  startDate: Date;
  endDate: Date;
}

/**
 * Calculate renewal start and end dates (UTC-based)
 * Start date is the day after current lease ends
 * End date is calculated based on the renewal term in months
 */
export function calculateRenewalDates(
  currentEndDate: Date,
  renewalTermMonths: number,
): RenewalDates {
  // Start the day after current lease ends
  const startDate = addDaysToDate(currentEndDate, 1);

  // Calculate end date by adding months and subtracting 1 day
  const endDate = addDaysToDate(addMonthsUTC(startDate, renewalTermMonths), -1);

  return {
    startDate,
    endDate,
  };
}

/**
 * Calculate rent increase for lease renewal
 * Checks lease-specific rent increase settings first, then falls back to config defaults
 */
export function calculateRentIncrease(
  lease: Lease,
  config?: RenewalConfig,
): RentIncreaseCalculation {
  let newRentAmount = lease.rentAmount;
  let rentIncrease = null;

  // Check if lease has predefined rent increase settings
  if (lease.rentIncrease) {
    rentIncrease = {
      type: lease.rentIncrease.type,
      amount: lease.rentIncrease.amount,
      reason: lease.rentIncrease.reason || 'Lease-specific rent increase',
    };

    if (lease.rentIncrease.type === RentIncreaseType.PERCENTAGE) {
      newRentAmount = lease.rentAmount * (1 + lease.rentIncrease.amount / 100);
    } else {
      newRentAmount = lease.rentAmount + lease.rentIncrease.amount;
    }
  } else if (config?.defaultRentIncreasePercentage && config.defaultRentIncreasePercentage > 0) {
    // Apply default rent increase if configured
    const increaseAmount = config.defaultRentIncreasePercentage;

    // Check if increase is within allowed limits
    if (increaseAmount <= config.maxRentIncreasePercentage) {
      rentIncrease = {
        type: RentIncreaseType.PERCENTAGE,
        amount: increaseAmount,
        reason: 'Automatic annual rent increase',
      };
      newRentAmount = lease.rentAmount * (1 + increaseAmount / 100);
    }
  }

  // Ensure rent increase doesn't exceed maximum allowed (if config provided)
  if (config?.maxRentIncreasePercentage) {
    const maxAllowedRent = lease.rentAmount * (1 + config.maxRentIncreasePercentage / 100);
    if (newRentAmount > maxAllowedRent) {
      newRentAmount = maxAllowedRent;
      if (rentIncrease) {
        rentIncrease.amount = config.maxRentIncreasePercentage;
        rentIncrease.reason += ' (capped at maximum allowed increase)';
      }
    }
  }

  return {
    newRentAmount: Math.round(newRentAmount * 100) / 100,
    rentIncrease,
  };
}

/**
 * Validate that renewal start date follows the day-after rule (UTC-based)
 */
export function validateRenewalStartDate(renewalStartDate: Date, currentEndDate: Date): void {
  const expectedStartDate = addDaysToDate(currentEndDate, 1);
  const normalizedRenewalStart = normalizeToDate(renewalStartDate);

  if (normalizedRenewalStart.getTime() !== expectedStartDate.getTime()) {
    throw new Error(
      `Renewal start date must be ${expectedStartDate.toISOString().split('T')[0]} (the day after current period ends)`,
    );
  }
}
