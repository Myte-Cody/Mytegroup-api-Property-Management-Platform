import { PaymentCycle } from '../../../common/enums/lease.enum';

/**
 * Generates a payment schedule based on rental period dates and payment cycle
 * @param periodStartDate - Start date of the rental period
 * @param periodEndDate - End date of the rental period
 * @param paymentCycle - Payment cycle (WEEKLY, MONTHLY, QUARTERLY, ANNUALLY)
 * @returns Array of payment due dates
 */
export function generatePaymentSchedule(
  periodStartDate: Date,
  periodEndDate: Date,
  paymentCycle: PaymentCycle
): Date[] {
  const dueDates: Date[] = [];
  let currentDate = new Date(periodStartDate);

  while (currentDate <= periodEndDate) {
    dueDates.push(new Date(currentDate));

    // Calculate next payment date based on cycle
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
        // Default to monthly if unknown cycle
        currentDate.setMonth(currentDate.getMonth() + 1);
        break;
    }
  }

  return dueDates;
}

/**
 * Calculates the number of payments for a given period and cycle
 * Useful for validation and estimation purposes
 */
export function calculatePaymentCount(
  periodStartDate: Date,
  periodEndDate: Date,
  paymentCycle: PaymentCycle
): number {
  return generatePaymentSchedule(periodStartDate, periodEndDate, paymentCycle).length;
}

/**
 * Gets the first payment due date for a rental period
 * Convenience function for single payment scenarios
 */
export function getFirstPaymentDueDate(
  periodStartDate: Date,
  periodEndDate: Date,
  paymentCycle: PaymentCycle
): Date {
  const schedule = generatePaymentSchedule(periodStartDate, periodEndDate, paymentCycle);
  return schedule[0] || periodStartDate;
}