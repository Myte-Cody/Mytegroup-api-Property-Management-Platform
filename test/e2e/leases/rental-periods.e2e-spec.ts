import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { createTestLease } from '../../fixtures/leases';
import { createTestProperty } from '../../fixtures/properties';
import { createRentalPeriodData } from '../../fixtures/rental-periods';
import { testTenant } from '../../fixtures/tenants';
import { createTestUnit } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Rental Periods (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let requestHelper: RequestHelper;
  let dbHelper: DatabaseHelper;
  let landlordToken: string;
  let tenantToken: string;
  let unitId: string;
  let tenantId: string;
  let propertyId: string;
  let leaseId: string;
  let rentalPeriodId: string;

  beforeAll(async () => {
    app = await createTestApp();
    authHelper = new AuthHelper(app);
    requestHelper = new RequestHelper(app);
    dbHelper = new DatabaseHelper(app);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    await dbHelper.clearCollection('Lease');
    await dbHelper.clearCollection('Unit');
    await dbHelper.clearCollection('Property');
    await dbHelper.clearCollection('Tenant');
    await dbHelper.clearCollection('User');
    await dbHelper.clearCollection('RentalPeriod');
    await dbHelper.clearCollection('Transaction');
  });

  describe('GET /rental-periods - Get all rental periods', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
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

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant',
          username: `tenant_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a property
      const propertyResponse = await requestHelper.post(
        '/properties',
        createTestProperty(timestamp),
        landlordToken,
      );
      propertyId = propertyResponse.body.data.property._id;

      // Create a unit
      const unitResponse = await requestHelper.post(
        `/properties/${propertyId}/units`,
        createTestUnit(timestamp),
        landlordToken,
      );
      unitId = unitResponse.body.data.unit._id;

      // Create a tenant
      const tenantResponse = await requestHelper.post(
        '/tenants',
        {
          ...testTenant,
          name: `Test Tenant ${timestamp}`,
          email: `test-tenant-${timestamp}@example.com`,
          username: `test_tenant_${timestamp}`,
          password: 'Password123!',
        },
        landlordToken,
      );
      tenantId = tenantResponse.body._id;

      // Create a lease
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;
    });

    it('should return paginated list of rental periods', async () => {
      const response = await requestHelper.get('/rental-periods', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter rental periods by lease ID', async () => {
      const response = await requestHelper
        .get(`/rental-periods?leaseId=${leaseId}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((rentalPeriod) => {
        expect(rentalPeriod.lease._id).toBe(leaseId);
      });
    });

    it('should filter rental periods by status', async () => {
      const response = await requestHelper
        .get('/rental-periods?status=ACTIVE', landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((rentalPeriod) => {
        expect(rentalPeriod.status).toBe('ACTIVE');
      });
    });

    it('should sort rental periods by start date', async () => {
      const response = await requestHelper
        .get('/rental-periods?sortBy=startDate&sortOrder=desc', landlordToken)
        .expect(200);

      const dates = response.body.data.map((rentalPeriod) =>
        new Date(rentalPeriod.startDate).getTime(),
      );
      const sortedDates = [...dates].sort((a, b) => b - a); // Sort descending

      expect(dates).toEqual(sortedDates);
    });

    it('should sort rental periods by due date', async () => {
      const response = await requestHelper
        .get('/rental-periods?sortBy=dueDate&sortOrder=asc', landlordToken)
        .expect(200);

      const dates = response.body.data.map((rentalPeriod) =>
        new Date(rentalPeriod.dueDate).getTime(),
      );
      const sortedDates = [...dates].sort((a, b) => a - b); // Sort ascending

      expect(dates).toEqual(sortedDates);
    });

    it('should sort rental periods by amount', async () => {
      const response = await requestHelper
        .get('/rental-periods?sortBy=amount&sortOrder=desc', landlordToken)
        .expect(200);

      const amounts = response.body.data.map((rentalPeriod) => rentalPeriod.amount);
      const sortedAmounts = [...amounts].sort((a, b) => b - a); // Sort descending

      expect(amounts).toEqual(sortedAmounts);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/rental-periods').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get('/rental-periods', tenantToken).expect(403);
    });
  });

  describe('GET /rental-periods/:id - Get rental period by ID', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
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

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant',
          username: `tenant_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a property
      const propertyResponse = await requestHelper.post(
        '/properties',
        createTestProperty(timestamp),
        landlordToken,
      );
      propertyId = propertyResponse.body.data.property._id;

      // Create a unit
      const unitResponse = await requestHelper.post(
        `/properties/${propertyId}/units`,
        createTestUnit(timestamp),
        landlordToken,
      );
      unitId = unitResponse.body.data.unit._id;

      // Create a tenant
      const tenantResponse = await requestHelper.post(
        '/tenants',
        {
          ...testTenant,
          name: `Test Tenant ${timestamp}`,
          email: `test-tenant-${timestamp}@example.com`,
          username: `test_tenant_${timestamp}`,
          password: 'Password123!',
        },
        landlordToken,
      );
      tenantId = tenantResponse.body._id;

      // Create a lease
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;

      // Get the current rental period of the lease
      const rentalPeriodResponse = await requestHelper.get(
        `/leases/${leaseId}/rental-periods/current`,
        landlordToken,
      );
      rentalPeriodId = rentalPeriodResponse.body._id;
    });

    it('should return the rental period with the specified ID', async () => {
      const response = await requestHelper.get(`/rental-periods/${rentalPeriodId}`, landlordToken);
      // .expect(200);

      expect(response.body).toHaveProperty('_id', rentalPeriodId);
      expect(response.body).toHaveProperty('lease._id', leaseId);
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('lease');
      expect(response.body).toHaveProperty('status');
    });

    it('should return 404 when rental period ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/rental-periods/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/rental-periods/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/rental-periods/${rentalPeriodId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/rental-periods/${rentalPeriodId}`, tenantToken).expect(403);
    });
  });

  describe('GET /rental-periods/lease/:leaseId/rent-history - Get rent history', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
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

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant',
          username: `tenant_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a property
      const propertyResponse = await requestHelper.post(
        '/properties',
        createTestProperty(timestamp),
        landlordToken,
      );
      propertyId = propertyResponse.body.data.property._id;

      // Create a unit
      const unitResponse = await requestHelper.post(
        `/properties/${propertyId}/units`,
        createTestUnit(timestamp),
        landlordToken,
      );
      unitId = unitResponse.body.data.unit._id;

      // Create a tenant
      const tenantResponse = await requestHelper.post(
        '/tenants',
        {
          ...testTenant,
          name: `Test Tenant ${timestamp}`,
          email: `test-tenant-${timestamp}@example.com`,
          username: `test_tenant_${timestamp}`,
          password: 'Password123!',
        },
        landlordToken,
      );
      tenantId = tenantResponse.body._id;

      // Create a lease
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;

      // Create multiple rental periods for the lease
      await requestHelper.post(
        '/rental-periods',
        createRentalPeriodData(timestamp, leaseId),
        landlordToken,
      );

      // Create a second rental period that is paid
      const secondRentalPeriod = createRentalPeriodData(timestamp + 1, leaseId);
      secondRentalPeriod.isPaid = true;
      secondRentalPeriod.startDate = new Date(Date.now() - 2592000000).toISOString(); // 30 days ago
      secondRentalPeriod.endDate = new Date(Date.now()).toISOString(); // today

      await requestHelper.post('/rental-periods', secondRentalPeriod, landlordToken);
    });

    it('should return rent history analytics for the lease', async () => {
      const response = await requestHelper
        .get(`/rental-periods/lease/${leaseId}/rent-history`, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('currentRent');
      expect(response.body).toHaveProperty('originalRent');
      expect(response.body).toHaveProperty('totalPeriods');
      expect(response.body).toHaveProperty('totalIncrease');
      expect(response.body).toHaveProperty('history');
      expect(response.body.totalPeriods).toBeGreaterThanOrEqual(1);
    });

    it('should return 404 when lease ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .get(`/rental-periods/lease/${nonExistentId}/rent-history`, landlordToken)
        .expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper
        .get('/rental-periods/lease/invalid-id/rent-history', landlordToken)
        .expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/rental-periods/lease/${leaseId}/rent-history`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .get(`/rental-periods/lease/${leaseId}/rent-history`, tenantToken)
        .expect(403);
    });
  });

  describe('GET /rental-periods/:id/renewal-chain - Get renewal chain', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
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

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'User',
          role: 'tenant',
          username: `tenant_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a property
      const propertyResponse = await requestHelper.post(
        '/properties',
        createTestProperty(timestamp),
        landlordToken,
      );
      propertyId = propertyResponse.body.data.property._id;

      // Create a unit
      const unitResponse = await requestHelper.post(
        `/properties/${propertyId}/units`,
        createTestUnit(timestamp),
        landlordToken,
      );
      unitId = unitResponse.body.data.unit._id;

      // Create a tenant
      const tenantResponse = await requestHelper.post(
        '/tenants',
        {
          ...testTenant,
          name: `Test Tenant ${timestamp}`,
          email: `test-tenant-${timestamp}@example.com`,
          username: `test_tenant_${timestamp}`,
          password: 'Password123!',
        },
        landlordToken,
      );
      tenantId = tenantResponse.body._id;

      // Create a lease
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;

      // Get the current rental period of the lease
      const rentalPeriodResponse = await requestHelper.get(
        `/leases/${leaseId}/rental-periods/current`,
        landlordToken,
      );
      rentalPeriodId = rentalPeriodResponse.body._id;

      // Create a renewal rental period with a reference to the original
      const renewalData = createRentalPeriodData(timestamp + 1, leaseId);
      renewalData.startDate = new Date(Date.now() + 2592000000).toISOString(); // 30 days later
      renewalData.endDate = new Date(Date.now() + 5184000000).toISOString(); // 60 days later

      await requestHelper.post('/rental-periods', renewalData, landlordToken);
    });

    it('should return complete renewal chain for the rental period', async () => {
      const response = await requestHelper
        .get(`/rental-periods/${rentalPeriodId}/renewal-chain`, landlordToken)
        .expect(200);

      expect(response.body.length).toBeGreaterThanOrEqual(1);
      expect(response.body[0]._id).toBe(rentalPeriodId);
    });

    it('should return 404 when rental period ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .get(`/rental-periods/${nonExistentId}/renewal-chain`, landlordToken)
        .expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper
        .get('/rental-periods/invalid-id/renewal-chain', landlordToken)
        .expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/rental-periods/${rentalPeriodId}/renewal-chain`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .get(`/rental-periods/${rentalPeriodId}/renewal-chain`, tenantToken)
        .expect(403);
    });
  });
});
