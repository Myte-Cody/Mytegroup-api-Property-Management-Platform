import { PaymentCycle } from '../../../common/enums/lease.enum';
import { normalizeToUTCStartOfDay } from './renewal.utils';

/**
 * Generates a transaction schedule based on rental period dates and payment cycle
 * @param periodStartDate - Start date of the rental period
 * @param periodEndDate - End date of the rental period
 * @param paymentCycle - Payment cycle (WEEKLY, MONTHLY, QUARTERLY, ANNUALLY)
 * @returns Array of transaction due dates
 */
export function generateTransactionSchedule(
  periodStartDate: Date,
  periodEndDate: Date,
  paymentCycle: PaymentCycle
): Date[] {
  const dueDates: Date[] = [];
  let currentDate = new Date(periodStartDate);

  while (currentDate <= periodEndDate) {
    dueDates.push(new Date(currentDate));

    // Calculate next transaction date based on cycle
    switch (paymentCycle) {
      case PaymentCycle.WEEKLY:
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case PaymentCycle.MONTHLY:
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case PaymentCycle.QUARTERLY:
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case PaymentCycle.ANNUALLY:
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  return dueDates;
}

/**
 * Calculates the number of transactions for a given period and cycle
 * Useful for validation and estimation purposes
 */
export function calculateTransactionCount(
  periodStartDate: Date,
  periodEndDate: Date,
  paymentCycle: PaymentCycle
): number {
  return generateTransactionSchedule(periodStartDate, periodEndDate, paymentCycle).length;
}

/**
 * Gets the first transaction due date for a rental period
 * Convenience function for single transaction scenarios
 */
export function getFirstTransactionDueDate(
  periodStartDate: Date,
  periodEndDate: Date,
  paymentCycle: PaymentCycle
): Date {
  const schedule = generateTransactionSchedule(periodStartDate, periodEndDate, paymentCycle);
  return schedule[0] || periodStartDate;
}

/**
 * Completes a desired end date to ensure the lease duration is a multiple of the payment cycle
 * @param startDate - The start date of the lease
 * @param desiredEndDate - The desired end date
 * @param paymentCycle - The payment cycle to use for completion
 * @returns The date that ensures the duration is a multiple of payment cycles
 */
export function completeFullCycle(
  startDate: Date,
  desiredEndDate: Date,
  paymentCycle: PaymentCycle
): Date {
  let currentDate = new Date(startDate);
  let cycles = 0;

  // Count how many complete cycles fit between start and desired end date
  while (currentDate < desiredEndDate) {
    cycles++;

    switch (paymentCycle) {
      case PaymentCycle.WEEKLY:
        currentDate.setDate(currentDate.getDate() + 7);
        break;
      case PaymentCycle.MONTHLY:
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
      case PaymentCycle.QUARTERLY:
        currentDate.setMonth(currentDate.getMonth() + 3);
        break;
      case PaymentCycle.ANNUALLY:
        currentDate.setFullYear(currentDate.getFullYear() + 1);
        break;
      default:
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  // Now calculate the end date with the complete number of cycles
  const completedEndDate = new Date(startDate);

  switch (paymentCycle) {
    case PaymentCycle.WEEKLY:
      completedEndDate.setDate(completedEndDate.getDate() + (cycles * 7));
      break;
    case PaymentCycle.MONTHLY:
      completedEndDate.setMonth(completedEndDate.getMonth() + cycles);
      break;
    case PaymentCycle.QUARTERLY:
      completedEndDate.setMonth(completedEndDate.getMonth() + (cycles * 3));
      break;
    case PaymentCycle.ANNUALLY:
      completedEndDate.setFullYear(completedEndDate.getFullYear() + cycles);
      break;
    default:
      completedEndDate.setMonth(completedEndDate.getMonth() + cycles);
      break;
  }

  return normalizeToUTCStartOfDay(completedEndDate);
}


