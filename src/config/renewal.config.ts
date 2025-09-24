import { registerAs } from '@nestjs/config';

export interface RenewalConfig {
  // Days before lease expiry to process auto-renewals
  renewalWindowDays: number;

  // Default renewal term in months
  defaultRenewalTermMonths: number;

  // Default rent increase percentage if none specified
  defaultRentIncreasePercentage: number;

  // Maximum allowed rent increase percentage
  maxRentIncreasePercentage: number;

  // Dry run mode (true = don't actually process renewals)
  dryRun: boolean;

  // Batch size for processing renewals
  batchSize: number;
}

export default registerAs(
  'renewal',
  (): RenewalConfig => ({
    renewalWindowDays: parseInt(process.env.RENEWAL_WINDOW_DAYS, 10) || 30,
    defaultRenewalTermMonths: parseInt(process.env.DEFAULT_RENEWAL_TERM_MONTHS, 10) || 12,
    defaultRentIncreasePercentage: parseFloat(process.env.DEFAULT_RENT_INCREASE_PERCENTAGE) || 0,
    maxRentIncreasePercentage: parseFloat(process.env.MAX_RENT_INCREASE_PERCENTAGE) || 20,
    dryRun: process.env.RENEWAL_DRY_RUN !== 'false', // Defaults to true unless explicitly set to false
    batchSize: parseInt(process.env.RENEWAL_BATCH_SIZE, 10) || 50,
  }),
);
