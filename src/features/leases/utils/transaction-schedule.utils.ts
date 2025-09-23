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
 * Calculates the proper end date for a rental period when terminating a lease
 * based on the payment cycle and termination date
 * @param terminationDate - The date when the lease is being terminated
 * @param paymentCycle - The payment cycle of the lease
 * @returns The calculated end date for the rental period
 */
export function calculateTerminationEndDate(
  terminationDate: Date,
  paymentCycle: PaymentCycle
): Date {
  const termDate = new Date(terminationDate);

  switch (paymentCycle) {
    case PaymentCycle.WEEKLY:
      // For weekly: terminate at the end of the week (Sunday)
      const daysUntilSunday = (7 - termDate.getDay()) % 7;
      termDate.setDate(termDate.getDate() + daysUntilSunday);
      break;

    case PaymentCycle.MONTHLY:
      // For monthly: terminate at the end of the month
      termDate.setMonth(termDate.getMonth() + 1, 0); // Last day of current month
      break;

    case PaymentCycle.QUARTERLY:
      // For quarterly: terminate at the end of the quarter
      const currentMonth = termDate.getMonth();
      const quarterEndMonth = Math.floor(currentMonth / 3) * 3 + 2;
      termDate.setMonth(quarterEndMonth + 1, 0); // Last day of quarter
      break;

    case PaymentCycle.ANNUALLY:
      // For annually: terminate at the end of the year
      termDate.setMonth(11, 31); // December 31st
      break;

    default:
      // Default to monthly behavior
      termDate.setMonth(termDate.getMonth() + 1, 0);
      break;
  }

  return normalizeToUTCStartOfDay(termDate);
}