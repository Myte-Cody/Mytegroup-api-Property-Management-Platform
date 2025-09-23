import { RentIncreaseType } from '../../../common/enums/lease.enum';
import { Lease } from '../schemas/lease.schema';
import { RenewalConfig } from '../../../config/renewal.config';

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
 * Normalize a date to UTC start of day (00:00:00.000Z)
 */
export function normalizeToUTCStartOfDay(date: Date): Date {
  const utcDate = new Date(date);
  utcDate.setUTCHours(0, 0, 0, 0);
  return utcDate;
}

/**
 * Calculate renewal start and end dates
 * Start date is the day after current lease ends
 * End date is calculated based on the renewal term in months
 */
export function calculateRenewalDates(
  currentEndDate: Date,
  renewalTermMonths: number
): RenewalDates {
  const startDate = new Date(currentEndDate);
  startDate.setDate(startDate.getDate() + 1); // Start the day after current lease ends

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + renewalTermMonths);
  endDate.setDate(endDate.getDate() - 1); // End the day before next term starts

  return {
    startDate: normalizeToUTCStartOfDay(startDate),
    endDate: normalizeToUTCStartOfDay(endDate)
  };
}

/**
 * Calculate rent increase for lease renewal
 * Checks lease-specific rent increase settings first, then falls back to config defaults
 */
export function calculateRentIncrease(
  lease: Lease,
  config?: RenewalConfig
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
    rentIncrease
  };
}

/**
 * Validate that renewal start date follows the day-after rule
 */
export function validateRenewalStartDate(
  renewalStartDate: Date,
  currentEndDate: Date
): void {
  const expectedStartDate = new Date(currentEndDate);
  expectedStartDate.setDate(expectedStartDate.getDate() + 1);

  if (renewalStartDate.getTime() !== expectedStartDate.getTime()) {
    throw new Error(
      `Renewal start date must be ${expectedStartDate.toISOString().split('T')[0]} (the day after current period ends)`
    );
  }
}