import { INestApplication } from '@nestjs/common';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import {
  LeaseStatus,
  PaymentStatus,
  PaymentType,
  RentalPeriodStatus,
} from '../../../src/common/enums/lease.enum';
import { UnitAvailabilityStatus } from '../../../src/common/enums/unit.enum';
import { getToday } from '../../../src/common/utils/date.utils';
import { LeaseEmailService } from '../../../src/features/email/services/lease-email.service';
import { PaymentEmailService } from '../../../src/features/email/services/payment-email.service';
import { StatusUpdaterService } from '../../../src/scripts/status-updater';
import { createScriptTestProperty } from '../../fixtures/properties';
import { testTenant } from '../../fixtures/tenants';
import { createTestUnit } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { createTestApp } from '../../test-app';

describe('StatusUpdater Script (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let connection: Connection;
  let leaseEmailService: LeaseEmailService;
  let paymentEmailService: PaymentEmailService;
  let statusUpdater: StatusUpdaterService;
  let landlordToken: string;
  let propertyId: string;
  let unitId: string;
  let tenantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authHelper = new AuthHelper(app);
    dbHelper = new DatabaseHelper(app);
    connection = app.get(getConnectionToken());
    leaseEmailService = app.get(LeaseEmailService);
    paymentEmailService = app.get(PaymentEmailService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test user and property setup
    const timestamp = Date.now() + Math.floor(Math.random() * 10000);

    const { token } = await authHelper
      .createUser({
        email: `landlord-${timestamp}@example.com`,
        password: 'Password123!',
        firstName: 'Landlord',
        lastName: 'User',
        role: 'landlord',
        username: `landlord_${timestamp}`,
        user_type: 'Landlord',
      })
      .then((user) => ({
        user,
        token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
      }));

    landlordToken = token;

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
        availabilityStatus: UnitAvailabilityStatus.VACANT,
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

    // Initialize status updater
    statusUpdater = new StatusUpdaterService(connection, leaseEmailService, paymentEmailService);
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

  describe('Rental Period Status Updates', () => {
    it('should update PENDING rental periods to ACTIVE when start date is reached', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create active lease
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: yesterday,
          endDate: new Date(Date.now() + 31536000000),
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create pending rental period with start date in the past
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: yesterday,
          endDate: new Date(Date.now() + 2592000000),
          rentAmount: 1200,
          status: RentalPeriodStatus.PENDING,
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.rentalPeriods.pendingToActive).toBe(1);

      const updatedPeriod = (await dbHelper
        .getModel('RentalPeriod')
        .findOne({ lease: lease[0]._id })
        .lean()) as any;
      expect(updatedPeriod?.status).toBe(RentalPeriodStatus.ACTIVE);
    });

    it('should update ACTIVE rental periods to EXPIRED when end date has passed', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Create active lease
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: twoDaysAgo,
          endDate: new Date(Date.now() + 31536000000),
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create active rental period with end date in the past
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: twoDaysAgo,
          endDate: yesterday,
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.rentalPeriods.activeToExpired).toBe(1);

      const updatedPeriod = (await dbHelper
        .getModel('RentalPeriod')
        .findOne({ lease: lease[0]._id })
        .lean()) as any;
      expect(updatedPeriod?.status).toBe(RentalPeriodStatus.EXPIRED);
    });
  });

  describe('Lease Status Updates', () => {
    it('should update ACTIVE leases to EXPIRED when end date has passed and no active periods', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create active lease with end date in the past
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: yesterday,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create expired rental period (no active periods)
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: new Date(Date.now() - 31536000000),
          endDate: yesterday,
          rentAmount: 1200,
          status: RentalPeriodStatus.EXPIRED,
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.leases.activeToExpired).toBe(1);

      const updatedLease = (await dbHelper.getModel('Lease').findById(lease[0]._id).lean()) as any;
      expect(updatedLease?.status).toBe(LeaseStatus.EXPIRED);
    });

    it('should NOT expire leases that still have active rental periods', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create active lease with end date in the past
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 31536000000),
          endDate: yesterday,
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create active rental period
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: today,
          endDate: new Date(Date.now() + 2592000000),
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.leases.activeToExpired).toBe(0);

      const updatedLease = (await dbHelper.getModel('Lease').findById(lease[0]._id).lean()) as any;
      expect(updatedLease?.status).toBe(LeaseStatus.ACTIVE);
    });
  });

  describe('Transaction Status Updates', () => {
    it('should update PENDING transactions to OVERDUE when due date has passed', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create active lease
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 2592000000),
          endDate: new Date(Date.now() + 31536000000),
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create pending transaction with due date in the past
      await dbHelper.seedCollection('Transaction', [
        {
          lease: lease[0]._id,
          amount: 1200,
          dueDate: yesterday,
          status: PaymentStatus.PENDING,
          type: PaymentType.RENT,
          periodStartDate: new Date(Date.now() - 2592000000),
          periodEndDate: new Date(Date.now()),
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.transactions.pendingToOverdue).toBe(1);

      const updatedTransaction = (await dbHelper
        .getModel('Transaction')
        .findOne({ lease: lease[0]._id })
        .lean()) as any;
      expect(updatedTransaction?.status).toBe(PaymentStatus.OVERDUE);
    });

    it('should NOT update transactions for non-active leases', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create terminated lease
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: new Date(Date.now() - 2592000000),
          endDate: new Date(Date.now() + 31536000000),
          rentAmount: 1200,
          status: LeaseStatus.TERMINATED,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create pending transaction
      await dbHelper.seedCollection('Transaction', [
        {
          lease: lease[0]._id,
          amount: 1200,
          dueDate: yesterday,
          status: PaymentStatus.PENDING,
          type: PaymentType.RENT,
          periodStartDate: new Date(Date.now() - 2592000000),
          periodEndDate: new Date(Date.now()),
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.transactions.pendingToOverdue).toBe(0);

      const transaction = (await dbHelper
        .getModel('Transaction')
        .findOne({ lease: lease[0]._id })
        .lean()) as any;
      expect(transaction?.status).toBe(PaymentStatus.PENDING);
    });
  });

  describe('Unit Availability Sync', () => {
    it('should update unit from VACANT to OCCUPIED when active lease with active period exists', async () => {
      const today = getToday();

      // Create active lease
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: today,
          endDate: new Date(Date.now() + 31536000000),
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create active rental period
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: today,
          endDate: new Date(Date.now() + 2592000000),
          rentAmount: 1200,
          status: RentalPeriodStatus.ACTIVE,
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.units.vacantToOccupied).toBe(1);

      const updatedUnit = (await dbHelper.getModel('Unit').findById(unitId).lean()) as any;
      expect(updatedUnit?.availabilityStatus).toBe(UnitAvailabilityStatus.OCCUPIED);
    });

    it('should update unit from OCCUPIED to VACANT when no active lease exists', async () => {
      // Update unit to occupied
      await dbHelper
        .getModel('Unit')
        .updateOne({ _id: unitId }, { availabilityStatus: UnitAvailabilityStatus.OCCUPIED });

      // No active lease or rental period

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.units.occupiedToVacant).toBe(1);

      const updatedUnit = (await dbHelper.getModel('Unit').findById(unitId).lean()) as any;
      expect(updatedUnit?.availabilityStatus).toBe(UnitAvailabilityStatus.VACANT);
    });
  });

  describe('Complete Status Update Flow', () => {
    it('should handle multiple status updates in a single execution', async () => {
      const today = getToday();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Create active lease
      const lease = await dbHelper.seedCollection('Lease', [
        {
          unit: unitId,
          tenant: tenantId,
          startDate: twoDaysAgo,
          endDate: new Date(Date.now() + 31536000000),
          rentAmount: 1200,
          status: LeaseStatus.ACTIVE,
          paymentCycle: 'MONTHLY',
        },
      ]);

      // Create pending rental period (should become active)
      await dbHelper.seedCollection('RentalPeriod', [
        {
          lease: lease[0]._id,
          startDate: yesterday,
          endDate: new Date(Date.now() + 2592000000),
          rentAmount: 1200,
          status: RentalPeriodStatus.PENDING,
        },
      ]);

      // Create overdue transaction
      await dbHelper.seedCollection('Transaction', [
        {
          lease: lease[0]._id,
          amount: 1200,
          dueDate: yesterday,
          status: PaymentStatus.PENDING,
          type: PaymentType.RENT,
          periodStartDate: twoDaysAgo,
          periodEndDate: yesterday,
        },
      ]);

      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary.rentalPeriods.pendingToActive).toBe(1);
      expect(summary.transactions.pendingToOverdue).toBe(1);
      expect(summary.units.vacantToOccupied).toBe(1);
      expect(summary.errors.length).toBe(0);
    });

    it('should return execution summary with timing information', async () => {
      const summary = await statusUpdater.executeStatusUpdates();

      expect(summary).toHaveProperty('executedAt');
      expect(summary).toHaveProperty('duration');
      expect(summary).toHaveProperty('rentalPeriods');
      expect(summary).toHaveProperty('leases');
      expect(summary).toHaveProperty('transactions');
      expect(summary).toHaveProperty('units');
      expect(summary).toHaveProperty('errors');
      expect(Array.isArray(summary.errors)).toBe(true);
    });
  });
});
