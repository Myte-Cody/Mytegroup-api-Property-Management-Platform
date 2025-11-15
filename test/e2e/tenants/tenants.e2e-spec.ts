import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { testTenant, testTenant2 } from '../../fixtures/tenants';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Tenants (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let requestHelper: RequestHelper;
  let dbHelper: DatabaseHelper;
  let landlordToken: string;
  let tenantToken: string;

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
    // Clean up all collections that might be used in tests
    await dbHelper.clearCollection('Tenant');
    await dbHelper.clearCollection('User');
  });

  describe('POST /tenants - Create a new tenant', () => {
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
    });

    it('should create a new tenant', async () => {
      const timestamp = Date.now();
      const newTenant = {
        name: 'New Test Tenant',
        phone: '555-123-4567',
        username: `new_tenant_${timestamp}`,
        firstName: `new`,
        lastName: 'tenant',
        email: `new-tenant-${timestamp}@example.com`,
        password: 'Password123!',
      };

      const response = await requestHelper.post('/tenants', newTenant, landlordToken).expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name', newTenant.name);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidTenant = {
        // Missing required fields: name, username, email, password
        phone: '555-123-4567',
      };

      await requestHelper.post('/tenants', invalidTenant, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      const timestamp = Date.now();
      const newTenant = {
        name: 'Unauthenticated Tenant',
        phone: '555-123-4567',
        username: `unauth_tenant_${timestamp}`,
        email: `unauth-tenant-${timestamp}@example.com`,
        password: 'Password123!',
      };

      await requestHelper.post('/tenants', newTenant).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      const timestamp = Date.now();
      const newTenant = {
        name: 'No Permission Tenant',
        phone: '555-123-4567',
        username: `noperm_tenant_${timestamp}`,
        email: `noperm-tenant-${timestamp}@example.com`,
        password: 'Password123!',
      };

      await requestHelper.post('/tenants', newTenant, tenantToken).expect(403);
    });
  });

  describe('GET /tenants - Get all tenants', () => {
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

      // Create multiple tenants for testing pagination and filtering
      await requestHelper.post('/tenants', testTenant, landlordToken);
      await requestHelper.post('/tenants', testTenant2, landlordToken);
    });

    it('should return paginated list of tenants', async () => {
      const response = await requestHelper.get('/tenants', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter tenants by name', async () => {
      const response = await requestHelper
        .get(`/tenants?search=${encodeURIComponent(testTenant2.name)}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].name).toBe(testTenant2.name);
    });

    it('should sort tenants by name (ascending)', async () => {
      const response = await requestHelper
        .get('/tenants?sortBy=name&sortOrder=asc', landlordToken)
        .expect(200);

      const names = response.body.data.map((tenant) => tenant.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should sort tenants by name (descending)', async () => {
      const response = await requestHelper
        .get('/tenants?sortBy=name&sortOrder=desc', landlordToken)
        .expect(200);

      const names = response.body.data.map((tenant) => tenant.name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/tenants').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get('/tenants', tenantToken).expect(403);
    });
  });

  describe('GET /tenants/:id - Get tenant by ID', () => {
    let tenantId: string;

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

      // Create a tenant for testing
      const response = await requestHelper.post('/tenants', testTenant, landlordToken);
      tenantId = response.body._id;
    });

    it('should return the tenant with the specified ID', async () => {
      const response = await requestHelper.get(`/tenants/${tenantId}`, landlordToken).expect(200);

      expect(response.body).toHaveProperty('_id', tenantId);
      expect(response.body).toHaveProperty('name', testTenant.name);
    });

    it('should return 404 when tenant ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/tenants/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/tenants/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/tenants/${tenantId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/tenants/${tenantId}`, tenantToken).expect(403);
    });
  });

  describe('GET /tenants/:id/stats - Get tenant statistics', () => {
    let tenantId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-tenantstats-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'TenantStats',
          role: 'landlord',
          username: `landlord_tenantstats_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-tenantstats-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'TenantStats',
          role: 'tenant',
          username: `tenant_tenantstats_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a tenant for testing
      const tenantResponse = await requestHelper.post(
        '/tenants',
        {
          ...testTenant,
          name: `Stats Test Tenant ${timestamp}`,
          email: `stats-tenant-${timestamp}@example.com`,
          username: `stats_tenant_${timestamp}`,
          password: 'Password123!',
        },
        landlordToken,
      );
      tenantId = tenantResponse.body._id;
    });

    it('should return statistics for a specific tenant', async () => {
      const response = await requestHelper
        .get(`/tenants/${tenantId}/stats`, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('activeLeases');
      expect(response.body).toHaveProperty('nextExpiry');
      expect(response.body).toHaveProperty('outstanding');
      expect(response.body).toHaveProperty('totalMonthlyRent');
    });

    it('should return 404 when tenant ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/tenants/${nonExistentId}/stats`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/tenants/invalid-id/stats', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/tenants/${tenantId}/stats`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/tenants/${tenantId}/stats`, tenantToken).expect(403);
    });
  });
});
