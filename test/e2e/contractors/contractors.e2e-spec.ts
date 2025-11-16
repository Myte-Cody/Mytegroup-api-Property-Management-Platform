import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { testContractor, testContractor2 } from '../../fixtures/contractors';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Contractors (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let requestHelper: RequestHelper;
  let dbHelper: DatabaseHelper;
  let landlordToken: string;
  let tenantToken: string;
  let contractorToken: string;

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
    await dbHelper.clearCollection('Contractor');
    await dbHelper.clearCollection('User');
  });

  describe('POST /contractors - Create a new contractor', () => {
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

    it('should create a new contractor', async () => {
      const timestamp = Date.now();
      const newContractor = {
        name: 'New Test Contractor',
        email: `contractor-${timestamp}@example.com`,
        password: 'Password123!',
      };

      const response = await requestHelper
        .post('/contractors', newContractor, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('name', newContractor.name);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidContractor = {
        // Missing required fields: name, email, password
      };

      await requestHelper.post('/contractors', invalidContractor, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      const timestamp = Date.now();
      const newContractor = {
        name: 'Unauthenticated Contractor',
        email: `unauth-${timestamp}@example.com`,
        password: 'Password123!',
      };

      await requestHelper.post('/contractors', newContractor).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      const timestamp = Date.now();
      const newContractor = {
        name: 'No Permission Contractor',
        email: `noperm-${timestamp}@example.com`,
        password: 'Password123!',
      };

      await requestHelper.post('/contractors', newContractor, tenantToken).expect(403);
    });
  });

  describe('GET /contractors - Get all contractors', () => {
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

      // Create multiple contractors for testing pagination and filtering
      await requestHelper.post('/contractors', testContractor, landlordToken);
      await requestHelper.post('/contractors', testContractor2, landlordToken);
    });

    it('should return paginated list of contractors', async () => {
      const response = await requestHelper.get('/contractors', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter contractors by name', async () => {
      const response = await requestHelper
        .get(`/contractors?search=${encodeURIComponent(testContractor2.name)}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].name).toBe(testContractor2.name);
    });

    it('should sort contractors by name (ascending)', async () => {
      const response = await requestHelper
        .get('/contractors?sortBy=name&sortOrder=asc', landlordToken)
        .expect(200);

      const names = response.body.data.map((contractor) => contractor.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should sort contractors by name (descending)', async () => {
      const response = await requestHelper
        .get('/contractors?sortBy=name&sortOrder=desc', landlordToken)
        .expect(200);

      const names = response.body.data.map((contractor) => contractor.name);
      const sortedNames = [...names].sort().reverse();
      expect(names).toEqual(sortedNames);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/contractors').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get('/contractors', tenantToken).expect(403);
    });
  });

  describe('GET /contractors/:id - Get contractor by ID', () => {
    let contractorId: string;

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

      // Create a contractor for testing with unique email
      const testContractorWithUniqueEmail = {
        name: 'Test Contractor',
        email: `test-contractor-${timestamp}@example.com`,
        password: 'Password123!',
      };

      const response = await requestHelper.post(
        '/contractors',
        testContractorWithUniqueEmail,
        landlordToken,
      );
      contractorId = response.body._id;
    });

    it('should return the contractor with the specified ID', async () => {
      const response = await requestHelper
        .get(`/contractors/${contractorId}`, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('_id', contractorId);
      expect(response.body).toHaveProperty('name', testContractor.name);
    });

    it('should return 404 when contractor ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/contractors/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/contractors/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/contractors/${contractorId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/contractors/${contractorId}`, tenantToken).expect(403);
    });
  });

  describe('PATCH /contractors/:id - Update contractor by ID', () => {
    let contractorId: string;

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

      // Create a contractor for testing with unique email
      const testContractorWithUniqueEmail = {
        name: 'Test Contractor',
        email: `test-contractor-patch-${timestamp}@example.com`,
        password: 'Password123!',
      };

      const response = await requestHelper.post(
        '/contractors',
        testContractorWithUniqueEmail,
        landlordToken,
      );
      contractorId = response.body._id;
    });

    it('should update the contractor with modified fields', async () => {
      const updateData = {
        name: 'Updated Contractor Name',
      };

      const response = await requestHelper
        .patch(`/contractors/${contractorId}`, updateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('name', updateData.name);
    });

    it('should return 404 when contractor ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .patch(`/contractors/${nonExistentId}`, { name: 'Nonexistent' }, landlordToken)
        .expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper
        .patch('/contractors/invalid-id', { name: 'Invalid' }, landlordToken)
        .expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper
        .patch(`/contractors/${contractorId}`, { name: 'Unauthenticated' })
        .expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .patch(`/contractors/${contractorId}`, { name: 'No Permission' }, tenantToken)
        .expect(403);
    });
  });

  describe('DELETE /contractors/:id - Delete contractor by ID', () => {
    let contractorId: string;

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

      // Create a contractor for testing
      const response = await requestHelper.post('/contractors', testContractor, landlordToken);
      contractorId = response.body._id;
    });

    it('should delete the contractor (soft delete)', async () => {
      await requestHelper.delete(`/contractors/${contractorId}`, landlordToken).expect(204);

      // Verify the contractor is not returned in GET requests (soft deleted)
      await requestHelper.get(`/contractors/${contractorId}`, landlordToken).expect(404);
    });

    it('should return 404 when contractor ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.delete(`/contractors/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.delete('/contractors/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.delete(`/contractors/${contractorId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.delete(`/contractors/${contractorId}`, tenantToken).expect(403);
    });
  });
});
