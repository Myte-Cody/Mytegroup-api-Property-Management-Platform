import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LeaseStatus, RentalPeriodStatus } from '../../../src/common/enums/lease.enum';
import { getToday } from '../../../src/common/utils/date.utils';
import { AutoRenewalService } from '../../../src/features/leases/services/auto-renewal.service';
import { createScriptTestProperty } from '../../fixtures/properties';
import { testTenant } from '../../fixtures/tenants';
import { createTestUnit } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { createTestApp } from '../../test-app';

describe('LeaseRenewal Script (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let autoRenewalService: AutoRenewalService;
  let configService: ConfigService;
  let propertyId: string;
  let unitId: string;
  let tenantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authHelper = new AuthHelper(app);
    dbHelper = new DatabaseHelper(app);
    autoRenewalService = app.get(AutoRenewalService);
    configService = app.get(ConfigService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test data
    const timestamp = Date.now() + Math.floor(Math.random() * 10000);

    // Create property
    const property = await dbHelper.seedCollection('Property', [
      createScriptTestProperty(timestamp),
    ]);
    propertyId = property[0]._id.toString();

    // Create unit
    const unit = await dbHelper.seedCollection('Unit', [
      {
        ...createTestUnit(timestamp),
        property: propertyId,
      },
    ]);
    unitId = unit[0]._id.toString();

    // Create tenant
    const tenant = await dbHelper.seedCollection('Tenant', [
      {
        ...testTenant,
        name: `Tenant ${timestamp}`,
      },
    ]);
    tenantId = tenant[0]._id.toString();
  });

  afterEach(async () => {
    await dbHelper.clearCollection('Lease');
    await dbHelper.clearCollection('RentalPeriod');
    await dbHelper.clearCollection('Transaction');
    await dbHelper.clearCollection('Unit');
    await dbHelper.clearCollection('Property');
    await dbHelper.clearCollection('Tenant');
    await dbHelper.clearCollection('User');
  });

  describe('Auto-Renewal Eligibility', () => {
    it('should identify leases eligible for auto-renewal', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25); // Within 30-day window

      // Create lease with autoRenewal enabled
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      // Create active rental period
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(1);
      expect(result.details.length).toBe(1);
      expect(result.details[0].leaseId).toBe(lease[0]._id.toString());
      expect(result.details[0].action).toBe('skipped'); // Dry run mode
      expect(result.details[0].reason).toBe('Dry run mode');
    });

    it('should NOT include leases without autoRenewal enabled', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      // Create lease WITHOUT autoRenewal
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: false,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(0);
    });

    it('should NOT include leases outside the renewal window', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 45); // Outside 30-day window

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(0);
    });

    it('should NOT include leases without active rental periods', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      // Create expired rental period (no active period)
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 5184000000),
          endDate: new Date(Date.now() - 2592000000),
          rentAmount: 1200,
          status: RentalPeriodStatus.EXPIRED,
        },
      ]);

      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(0);
    });

    it('should NOT include leases that already have future rental periods', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      // Create active rental period
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      // Create future rental period
      const futureStart = new Date(expiryDate);
      futureStart.setDate(futureStart.getDate() + 1);
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: futureStart,
          endDate: new Date(futureStart.getTime() + 31536000000),
          rentAmount: 1200,
          status: RentalPeriodStatus.PENDING,
        },
      ]);

      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(0);
    });
  });

  describe('Dry Run Mode', () => {
    it('should preview renewals without making changes in dry run mode', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: true,
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(0); // No actual renewals in dry run
      expect(result.details[0].action).toBe('skipped');
      expect(result.details[0].reason).toBe('Dry run mode');

      // Verify no new rental periods were created
      const rentalPeriods = await dbHelper.getModel('RentalPeriod').find({ lease: lease[0]._id });
      expect(rentalPeriods.length).toBe(1); // Still only the original period
    });
  });

  describe('Live Renewal Processing', () => {
    it('should successfully renew eligible leases in live mode', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: false,
        renewalWindowDays: 30,
        defaultRenewalTermMonths: 12,
        defaultRentIncreasePercentage: 0,
      });

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.details[0].action).toBe('renewed');

      // Verify new rental period was created
      const rentalPeriods = await dbHelper
        .getModel('RentalPeriod')
        .find({ lease: lease[0]._id })
        .sort({ startDate: 1 });
      expect(rentalPeriods.length).toBe(2); // Original + new period

      // Verify the new period details
      const newPeriod = rentalPeriods[1] as any;
      expect(newPeriod.status).toBe(RentalPeriodStatus.PENDING);
      expect(new Date(newPeriod.startDate).getTime()).toBeGreaterThan(
        new Date(expiryDate).getTime(),
      );
    });

    it('should apply rent increase when configured on lease', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      // Create lease with rent increase settings
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1000,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
          rentIncrease: {
            type: 'PERCENTAGE',
            amount: 5,
            reason: 'Annual increase',
          },
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1000,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: false,
        renewalWindowDays: 30,
        defaultRenewalTermMonths: 12,
      });

      expect(result.processed).toBe(1);
      expect(result.successful).toBe(1);
      expect(result.details[0].oldRent).toBe(1000);
      expect(result.details[0].newRent).toBe(1050); // 5% increase from lease settings

      // Verify new rental period has increased rent
      const rentalPeriods = await dbHelper
        .getModel('RentalPeriod')
        .find({ lease: lease[0]._id })
        .sort({ startDate: 1 });
      const newPeriod = rentalPeriods[1] as any;
      expect(newPeriod.rentAmount).toBe(1050);
    });

    it('should handle multiple leases in batch processing', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      // Create second unit and tenant
      const unit2 = await dbHelper.seedCollection('Unit', [
        {
          ...createTestUnit(Date.now() + 1),
          property: propertyId,
        },
      ]);
      const tenant2 = await dbHelper.seedCollection('Tenant', [
        {
          ...testTenant,
          name: 'Tenant 2',
        },
      ]);

      // Create two leases
      const leases = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
        {
          unit: unit2[0]._id,
          tenant: tenant2[0]._id,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1500,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      // Create rental periods for both
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: leases[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
        {
          lease: leases[1]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1500,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: false,
        renewalWindowDays: 30,
        defaultRenewalTermMonths: 12,
        defaultRentIncreasePercentage: 0,
        batchSize: 10,
      });

      expect(result.processed).toBe(2);
      expect(result.successful).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.details.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle errors gracefully and continue processing other leases', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      // Create two leases - one valid, one that will have issues
      const unit2 = await dbHelper.seedCollection('Unit', [
        {
          ...createTestUnit(Date.now() + 1),
          property: propertyId,
        },
      ]);
      const tenant2 = await dbHelper.seedCollection('Tenant', [
        {
          ...testTenant,
          name: 'Tenant 2',
        },
      ]);

      const leases = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
        {
          unit: unit2[0]._id,
          tenant: tenant2[0]._id,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1500,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      // Create active rental periods for both
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: leases[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
        {
          lease: leases[1]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1500,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      // Delete the second tenant to cause issues with second lease
      await dbHelper.getModel('Tenant').deleteOne({ _id: tenant2[0]._id });

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: false,
        renewalWindowDays: 30,
      });

      expect(result.processed).toBe(2);
      // First lease should succeed, second may have issues but process continues
      expect(result.successful).toBeGreaterThanOrEqual(1);
      expect(result.details.length).toBe(2);
    });

    it('should provide detailed result information for all processed leases', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: false,
        renewalWindowDays: 30,
      });

      // Verify result structure
      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(result.details.length).toBeGreaterThan(0);
      expect(result.details[0]).toHaveProperty('leaseId');
      expect(result.details[0]).toHaveProperty('action');
    });
  });

  describe('Configuration Overrides', () => {
    it('should respect custom renewal window days', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 10); // 10 days away

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      // Should not find with 7-day window
      const result1 = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 7,
      });
      expect(result1.processed).toBe(0);

      // Should find with 15-day window
      const result2 = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 15,
      });
      expect(result2.processed).toBe(1);
    });

    it('should respect custom batch size', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      // Create 3 leases
      const leases: any[] = [];
      const units: any[] = [];
      const tenants: any[] = [];

      for (let i = 0; i < 3; i++) {
        const unit = await dbHelper.seedCollection('Unit', [
          {
            ...createTestUnit(Date.now() + i),
            property: propertyId,
          },
        ]);
        units.push(unit[0]);

        const tenant = await dbHelper.seedCollection('Tenant', [
          {
            ...testTenant,
            name: `Tenant ${i}`,
          },
        ]);
        tenants.push(tenant[0]);

        const lease = await dbHelper.seedCollection('Lease', [
          {
            unit: unit[0]._id,
            tenant: tenant[0]._id,
            startDate: new Date(Date.now() - 31536000000),
            endDate: expiryDate,
            rentAmount: 1200,
            status: LeaseStatus.ACTIVE,
            paymentCycle: 'MONTHLY',
            autoRenewal: true,
          },
        ]);
        leases.push(lease[0]);

        await dbHelper.seedCollection('RentalPeriod', [
          {
            lease: lease[0]._id,
            startDate: new Date(Date.now() - 2592000000),
            endDate: expiryDate,
            rentAmount: 1200,
            status: RentalPeriodStatus.ACTIVE,
          },
        ]);
      }

      const result = await autoRenewalService.processAutoRenewals({
        dryRun: false,
        renewalWindowDays: 30,
        batchSize: 2, // Process 2 at a time
      });

      expect(result.processed).toBe(3);
      expect(result.successful).toBe(3);
    });
  });

  describe('Result Summary', () => {
    it('should return comprehensive result summary', async () => {
      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result).toHaveProperty('processed');
      expect(result).toHaveProperty('successful');
      expect(result).toHaveProperty('failed');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('details');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.details)).toBe(true);
    });

    it('should include detailed information for each processed lease', async () => {
      const today = getToday();
      const expiryDate = new Date(today);
      expiryDate.setDate(expiryDate.getDate() + 25);

      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
          autoRenewal: true,
        },
      ]);

      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 2592000000),
          endDate: expiryDate,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const result = await autoRenewalService.getRenewalPreview({
        renewalWindowDays: 30,
      });

      expect(result.details[0]).toHaveProperty('leaseId');
      expect(result.details[0]).toHaveProperty('oldEndDate');
      expect(result.details[0]).toHaveProperty('newEndDate');
      expect(result.details[0]).toHaveProperty('oldRent');
      expect(result.details[0]).toHaveProperty('newRent');
      expect(result.details[0]).toHaveProperty('action');
      expect(result.details[0].leaseId).toBe(lease[0]._id.toString());
    });
  });
});
