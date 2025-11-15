#!/usr/bin/env ts-node

import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Command } from 'commander';
import { AppModule } from '../app.module';
import { RenewalConfig } from '../config/renewal.config';
import { AutoRenewalService } from '../features/leases/services/auto-renewal.service';

const logger = new Logger('LeaseRenewalScript');

async function createApp() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  return app;
}

async function runRenewalProcess(options: any) {
  const app = await createApp();

  try {
    const autoRenewalService = app.get(AutoRenewalService);
    const configService = app.get(ConfigService);

    // Get base configuration from ConfigService and override with command line options
    const baseConfig = configService.get<RenewalConfig>('renewal');
    const configOverrides: Partial<RenewalConfig> = {
      // Override with command line options
      dryRun: options.dryRun !== false, // Default to true unless explicitly set to false
      ...(options.days && { renewalWindowDays: options.days }),
      ...(options.increase && { defaultRentIncreasePercentage: options.increase }),
      ...(options.batchSize && { batchSize: options.batchSize }),
    };

    const finalConfig = { ...baseConfig, ...configOverrides };

    logger.log('='.repeat(60));
    logger.log('🏠 AUTOMATED LEASE RENEWAL SCRIPT');
    logger.log('='.repeat(60));
    logger.log(`Mode: ${finalConfig.dryRun ? '🧪 DRY RUN' : '🚀 LIVE EXECUTION'}`);
    logger.log(`Renewal Window: ${finalConfig.renewalWindowDays} days`);
    logger.log(`Default Rent Increase: ${finalConfig.defaultRentIncreasePercentage}%`);
    logger.log(`Batch Size: ${finalConfig.batchSize}`);
    logger.log('='.repeat(60));

    const result = await autoRenewalService.processAutoRenewals(configOverrides);

    // Display results
    logger.log('');
    logger.log('📊 RENEWAL PROCESSING RESULTS');
    logger.log('='.repeat(60));
    logger.log(`📋 Total Leases Processed: ${result.processed}`);
    logger.log(`✅ Successful Renewals: ${result.successful}`);
    logger.log(`❌ Failed Renewals: ${result.failed}`);
    logger.log('');

    if (result.details.length > 0) {
      logger.log('📝 DETAILED RESULTS:');
      logger.log('-'.repeat(60));

      result.details.forEach((detail, index) => {
        const status = detail.action === 'renewed' ? '✅' : detail.action === 'error' ? '❌' : '⏭️';

        logger.log(`${status} ${index + 1}. Lease ${detail.leaseId.substring(0, 8)}...`);
        logger.log(
          `   End Date: ${detail.oldEndDate.toISOString().split('T')[0]} → ${detail.newEndDate.toISOString().split('T')[0]}`,
        );
        logger.log(`   Rent: $${detail.oldRent} → $${detail.newRent}`);
        if (detail.reason) {
          logger.log(`   Reason: ${detail.reason}`);
        }
        logger.log('');
      });
    }

    if (result.errors.length > 0) {
      logger.log('🚨 ERRORS ENCOUNTERED:');
      logger.log('-'.repeat(60));
      result.errors.forEach((error, index) => {
        logger.error(`${index + 1}. Lease ${error.leaseId.substring(0, 8)}`);
        logger.error(`   Error: ${error.error}`);
      });
      logger.log('');
    }

    if (finalConfig.dryRun) {
      logger.warn('');
      logger.warn('⚠️  This was a DRY RUN - no actual renewals were processed');
      logger.warn('   To execute renewals, run with --no-dry-run flag');
    }

    logger.log('='.repeat(60));
    logger.log('✨ Lease renewal script completed');
    logger.log('='.repeat(60));
  } catch (error) {
    logger.error('💥 Critical error in lease renewal script:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

async function runPreview(options: any) {
  const app = await createApp();

  try {
    const autoRenewalService = app.get(AutoRenewalService);
    const configService = app.get(ConfigService);

    const baseConfig = configService.get<RenewalConfig>('renewal');
    const configOverrides: Partial<RenewalConfig> = {
      dryRun: true, // Force dry run for preview
      ...(options.days && { renewalWindowDays: options.days }),
    };

    const finalConfig = { ...baseConfig, ...configOverrides };

    logger.log('='.repeat(60));
    logger.log('🔍 LEASE RENEWAL PREVIEW');
    logger.log('='.repeat(60));
    logger.log(`Checking leases expiring within ${finalConfig.renewalWindowDays} days...`);
    logger.log('='.repeat(60));

    const result = await autoRenewalService.getRenewalPreview(configOverrides);

    logger.log(`📋 Found ${result.processed} eligible leases for auto-renewal`);

    if (result.details.length > 0) {
      logger.log('');
      logger.log('📝 ELIGIBLE LEASES:');
      logger.log('-'.repeat(60));

      result.details.forEach((detail, index) => {
        logger.log(`${index + 1}. Lease ${detail.leaseId.substring(0, 8)}...`);
        logger.log(`   Current End: ${detail.oldEndDate.toISOString().split('T')[0]}`);
        logger.log(`   Would Extend To: ${detail.newEndDate.toISOString().split('T')[0]}`);
        logger.log(`   Rent Change: $${detail.oldRent} → $${detail.newRent}`);
        logger.log('');
      });
    } else {
      logger.log('✨ No leases currently eligible for auto-renewal');
    }

    logger.log('='.repeat(60));
  } catch (error) {
    logger.error('💥 Error in preview:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// CLI Setup
const program = new Command();

program
  .name('lease-renewal')
  .description('Automated lease renewal script for property management')
  .version('1.0.0');

program
  .command('process')
  .description('Process auto-renewals for eligible leases')
  .option('--no-dry-run', 'Execute actual renewals (default is dry run)')
  .option('-d, --days <number>', 'Days before expiry to process renewals', parseInt)
  .option('-i, --increase <number>', 'Default rent increase percentage', parseFloat)
  .option('-b, --batch-size <number>', 'Batch size for processing', parseInt)
  .action(runRenewalProcess);

program
  .command('preview')
  .description('Preview eligible leases without processing renewals')
  .option('-d, --days <number>', 'Days before expiry to check', parseInt)
  .action(runPreview);

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
if (require.main === module) {
  program.parse(process.argv);
}
