import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  createDraftLease,
  createTestLease,
  renewLeaseData,
  terminateLeaseData,
  updateLeaseData,
} from '../../fixtures/leases';
import { createTestProperty } from '../../fixtures/properties';
import { testTenant } from '../../fixtures/tenants';
import { createTestUnit } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Leases (e2e)', () => {
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

  describe('GET /leases - Get all leases', () => {
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

      const { token: tenant, user: tenantUser } = await authHelper
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

      // Create multiple leases for testing pagination and filtering
      const lease1 = createTestLease(timestamp, unitId, tenantId);
      await requestHelper.post('/leases', lease1, landlordToken);
    });

    it('should return paginated list of leases', async () => {
      const response = await requestHelper.get('/leases', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(response.body.meta).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter leases by tenant', async () => {
      const response = await requestHelper
        .get(`/leases?tenantId=${tenantId}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((lease) => {
        expect(lease.tenant._id).toBe(tenantId);
      });
    });

    it('should filter leases by property', async () => {
      const response = await requestHelper
        .get(`/leases?propertyId=${propertyId}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter leases by unit', async () => {
      const response = await requestHelper
        .get(`/leases?unitId=${unitId}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((lease) => {
        expect(lease.unit._id).toBe(unitId);
      });
    });

    it('should filter leases by status', async () => {
      const response = await requestHelper.get('/leases?status=ACTIVE', landlordToken).expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((lease) => {
        expect(lease.status).toBe('ACTIVE');
      });
    });

    it('should sort leases by start date', async () => {
      const response = await requestHelper
        .get('/leases?sortBy=startDate&sortOrder=desc', landlordToken)
        .expect(200);

      const dates = response.body.data.map((lease) => new Date(lease.startDate).getTime());
      const sortedDates = [...dates].sort((a, b) => b - a); // Sort descending

      expect(dates).toEqual(sortedDates);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/leases').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get('/leases', tenantToken).expect(403);
    });
  });

  describe('GET /leases/:id - Get lease by ID', () => {
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

      // Create a lease for testing
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;
    });

    it('should return the lease with the specified ID', async () => {
      const response = await requestHelper.get(`/leases/${leaseId}`, landlordToken).expect(200);

      expect(response.body).toHaveProperty('_id', leaseId);
      expect(response.body).toHaveProperty('unit._id', unitId);
      expect(response.body).toHaveProperty('tenant._id', tenantId);
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('rentAmount');
    });

    it('should return 404 when lease ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/leases/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/leases/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/leases/${leaseId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/leases/${leaseId}`, tenantToken).expect(403);
    });
  });

  describe('POST /leases - Create a new lease', () => {
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
    });

    it('should create a new lease', async () => {
      const timestamp = Date.now();
      const newLease = createTestLease(timestamp, unitId, tenantId);

      const response = await requestHelper.post('/leases', newLease, landlordToken).expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('unit', unitId);
      expect(response.body).toHaveProperty('tenant', tenantId);
      expect(response.body).toHaveProperty('rentAmount', newLease.rentAmount);
      expect(response.body).toHaveProperty('isSecurityDeposit', newLease.isSecurityDeposit);
      expect(response.body).toHaveProperty('securityDepositAmount', newLease.securityDepositAmount);
      expect(response.body).toHaveProperty('status', newLease.status);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidLease = {
        // Missing required fields
        rentAmount: 1200,
      };

      await requestHelper.post('/leases', invalidLease, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      const newLease = createTestLease(Date.now(), unitId, tenantId);
      await requestHelper.post('/leases', newLease).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      const newLease = createTestLease(Date.now(), unitId, tenantId);
      await requestHelper.post('/leases', newLease, tenantToken).expect(403);
    });
  });

  describe('PATCH /leases/:id - Update lease details', () => {
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

      // Create a lease for testing
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;
    });

    it('should update the lease with modified fields', async () => {
      const response = await requestHelper
        .patch(`/leases/${leaseId}`, updateLeaseData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('_id', leaseId);
      expect(response.body).toHaveProperty(
        'securityDepositRefundedAt',
        updateLeaseData.securityDepositRefundedAt,
      );
      expect(response.body).toHaveProperty(
        'securityDepositRefundReason',
        updateLeaseData.securityDepositRefundReason,
      );
      expect(response.body).toHaveProperty('autoRenewal', updateLeaseData.autoRenewal);
    });

    it('should return 404 when lease ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .patch(`/leases/${nonExistentId}`, updateLeaseData, landlordToken)
        .expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.patch('/leases/invalid-id', updateLeaseData, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.patch(`/leases/${leaseId}`, updateLeaseData).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.patch(`/leases/${leaseId}`, updateLeaseData, tenantToken).expect(403);
    });
  });

  describe('POST /leases/:id/terminate - Terminate a lease', () => {
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

      // Create a lease for testing
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;
    });

    it('should terminate the lease', async () => {
      const response = await requestHelper
        .post(`/leases/${leaseId}/terminate`, terminateLeaseData, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('_id', leaseId);
      expect(response.body).toHaveProperty('status', 'TERMINATED');
      expect(response.body).toHaveProperty('terminationDate');
      expect(response.body).toHaveProperty(
        'terminationReason',
        terminateLeaseData.terminationReason,
      );
    });

    it('should return 404 when lease ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .post(`/leases/${nonExistentId}/terminate`, terminateLeaseData, landlordToken)
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.post(`/leases/${leaseId}/terminate`, terminateLeaseData).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .post(`/leases/${leaseId}/terminate`, terminateLeaseData, tenantToken)
        .expect(403);
    });
  });

  describe('POST /leases/:id/renew - Manually renew a lease', () => {
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

      // Create a lease for testing
      const leaseResponse = await requestHelper.post(
        '/leases',
        createTestLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;
    });

    it('should renew the lease', async () => {
      const response = await requestHelper
        .post(`/leases/${leaseId}/renew`, renewLeaseData, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('lease');
      expect(response.body.lease).toHaveProperty('_id');
      expect(response.body.lease).toHaveProperty('unit', unitId);
      expect(response.body.lease).toHaveProperty('tenant', tenantId);
    });

    it('should return 404 when lease ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .post(`/leases/${nonExistentId}/renew`, renewLeaseData, landlordToken)
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.post(`/leases/${leaseId}/renew`, renewLeaseData).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.post(`/leases/${leaseId}/renew`, renewLeaseData, tenantToken).expect(403);
    });
  });

  describe('DELETE /leases/:id - Delete a lease', () => {
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

      // Create a draft lease for testing deletion
      const leaseResponse = await requestHelper.post(
        '/leases',
        createDraftLease(timestamp, unitId, tenantId),
        landlordToken,
      );
      leaseId = leaseResponse.body._id;
    });

    it('should delete a draft lease', async () => {
      await requestHelper.delete(`/leases/${leaseId}`, landlordToken).expect(204);
    });

    it('should return 404 when lease ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.delete(`/leases/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when trying to delete a non-draft lease', async () => {
      // Create an active lease
      const timestamp = Date.now();
      const activeLease = createTestLease(timestamp, unitId, tenantId);
      const activeLeaseResponse = await requestHelper.post('/leases', activeLease, landlordToken);
      const activeLeaseId = activeLeaseResponse.body._id;

      // Try to delete the active lease
      await requestHelper.delete(`/leases/${activeLeaseId}`, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.delete(`/leases/${leaseId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.delete(`/leases/${leaseId}`, tenantToken).expect(403);
    });
  });
});
