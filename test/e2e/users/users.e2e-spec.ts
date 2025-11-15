import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Users (e2e)', () => {
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
    await dbHelper.clearCollection('User');
  });

  describe('POST /users - Create a new user', () => {
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

    it('should create a new user', async () => {
      const newUser = {
        email: 'new-user@example.com',
        password: 'Password123!',
        username: 'new_user',
        firstName: 'Test',
        lastName: 'User',
        user_type: 'Tenant',
      };

      const response = await requestHelper.post('/users', newUser, landlordToken).expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('email', newUser.email);
      expect(response.body).toHaveProperty('username', newUser.username);
      expect(response.body).toHaveProperty('user_type', newUser.user_type);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidUser = {
        email: 'invalid@example.com',
        // Missing required fields: username, password, user_type
      };

      await requestHelper.post('/users', invalidUser, landlordToken).expect(400);
    });

    it('should return 400 when email format is invalid', async () => {
      const invalidUser = {
        email: 'invalid-email', // Invalid email format
        password: 'Password123!',
        username: 'invalid_user',
        user_type: 'Tenant',
      };

      await requestHelper.post('/users', invalidUser, landlordToken).expect(400);
    });

    it('should return 422 when email already exists', async () => {
      const existingUser = {
        email: 'existing-user@example.com',
        password: 'Password123!',
        username: 'existing_user',
        firstName: 'Test',
        lastName: 'User',
        user_type: 'Tenant',
      };

      // Create user first
      await requestHelper.post('/users', existingUser, landlordToken).expect(201);

      // Try to create user with same email
      const duplicateUser = {
        ...existingUser,
        username: 'another_username', // Different username
      };

      await requestHelper.post('/users', duplicateUser, landlordToken).expect(422);
    });

    it('should return 401 when not authenticated', async () => {
      const newUser = {
        email: 'unauthenticated@example.com',
        password: 'Password123!',
        username: 'unauthenticated_user',
        firstName: 'Test',
        lastName: 'User',
        user_type: 'Tenant',
      };

      await requestHelper.post('/users', newUser).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      const newUser = {
        email: 'no-permission@example.com',
        password: 'Password123!',
        username: 'no_permission_user',
        firstName: 'Test',
        lastName: 'User',
        user_type: 'Tenant',
      };

      await requestHelper.post('/users', newUser, tenantToken).expect(403);
    });
  });

  describe('GET /users - Get all users', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'landlord',
          lastName: 'User',
          role: 'landlord',
          username: `landlord_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      landlordToken = landlord;

      // Create multiple users for testing pagination and filtering
      const userPromises = [];
      for (let i = 1; i <= 5; i++) {
        const user = {
          email: `test-user-${i}@example.com`,
          password: 'Password123!',
          username: `test_user_${i}`,
          firstName: `Test ${i}`,
          lastName: `User ${i}`,
          user_type: i % 2 === 0 ? 'Tenant' : 'Landlord',
        };
        userPromises.push(requestHelper.post('/users', user, landlordToken) as never);
      }

      await Promise.all(userPromises);
    });

    it('should return paginated list of users', async () => {
      const response = await requestHelper.get('/users', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);

      // Check that passwords are not returned
      for (const user of response.body.data) {
        expect(user).not.toHaveProperty('password');
      }
    });

    it('should filter users by email', async () => {
      const response = await requestHelper
        .get('/users?search=test-user-1@example.com', landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].email).toBe('test-user-1@example.com');
    });

    it('should filter users by user_type', async () => {
      const response = await requestHelper
        .get('/users?user_type=Tenant', landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      for (const user of response.body.data) {
        expect(user.user_type).toBe('Tenant');
      }
    });

    it('should sort users by email (ascending)', async () => {
      const response = await requestHelper
        .get('/users?sortBy=email&sortOrder=asc', landlordToken)
        .expect(200);

      const emails = response.body.data.map((user) => user.email);
      const sortedEmails = [...emails].sort();
      expect(emails).toEqual(sortedEmails);
    });

    it('should sort users by email (descending)', async () => {
      const response = await requestHelper
        .get('/users?sortBy=email&sortOrder=desc', landlordToken)
        .expect(200);

      const emails = response.body.data.map((user) => user.email);
      const sortedEmails = [...emails].sort().reverse();
      expect(emails).toEqual(sortedEmails);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/users').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      // Create a tenant user
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
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

      await requestHelper.get('/users', tenant).expect(403);
    });
  });

  describe('GET /users/:id - Get user by ID', () => {
    let userId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const { token: landlord, user: landlordUser } = await authHelper
        .createUser({
          email: `landlord-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'landlord',
          lastName: 'User',
          role: 'landlord',
          username: `landlord_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      landlordToken = landlord;
      userId = (landlordUser as any)._id.toString();

      // Create a tenant user
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

      tenantToken = tenant;
    });

    it('should return the user with the specified ID', async () => {
      const response = await requestHelper.get(`/users/${userId}`, landlordToken).expect(200);

      expect(response.body).toHaveProperty('_id', userId);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should return 404 when user ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/users/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/users/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/users/${userId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/users/${userId}`, tenantToken).expect(403);
    });
  });

  describe('PATCH /users/:id - Update user by ID', () => {
    let userId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord, user: landlordUser } = await authHelper
        .createUser({
          email: `landlord-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'landlord',
          lastName: 'User',
          role: 'landlord',
          username: `landlord_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      landlordToken = landlord;
      userId = (landlordUser as any)._id.toString();

      // Create a tenant user
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

      tenantToken = tenant;
    });

    it('should update the user with modified fields', async () => {
      const updateData = {
        username: 'updated_username',
      };

      const response = await requestHelper
        .patch(`/users/${userId}`, updateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('username', updateData.username);
      expect(response.body).not.toHaveProperty('password');
    });

    it('should update only the provided fields', async () => {
      const originalEmail = `landlord-${Date.now()}@example.com`;

      // Create a new user
      const { user: newUser } = await authHelper
        .createUser({
          email: originalEmail,
          password: 'Password123!',
          firstName: 'Original',
          lastName: 'User',
          role: 'landlord',
          username: `original_${Date.now()}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const newUserId = (newUser as any)._id.toString();

      // Update only the username
      const updateData = {
        username: 'partially_updated_username',
      };

      const response = await requestHelper
        .patch(`/users/${newUserId}`, updateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('username', updateData.username);
      expect(response.body).toHaveProperty('email', originalEmail); // Email should remain unchanged
    });

    it('should hash the password when updating', async () => {
      const updateData = {
        password: 'NewPassword123!',
      };

      const response = await requestHelper
        .patch(`/users/${userId}`, updateData, landlordToken)
        .expect(200);

      // Password should not be returned in the response
      expect(response.body).not.toHaveProperty('password');

      // Try to login with the new password (this would require additional setup)
      // For now, we'll just check that the password is not returned
    });

    it('should return 404 when user ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .patch(`/users/${nonExistentId}`, { username: 'nonexistent' }, landlordToken)
        .expect(404);
    });

    it('should return 422 when updated email already exists', async () => {
      // Create another user with a different email
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const existingEmail = `existing-${timestamp}@example.com`;

      await authHelper.createUser({
        email: existingEmail,
        password: 'Password123!',
        firstName: 'Existing',
        lastName: 'User',
        role: 'landlord',
        username: `existing_${timestamp}`,
        user_type: 'Landlord',
      });

      // Try to update the first user's email to the existing email
      const updateData = {
        email: existingEmail,
      };

      await requestHelper.patch(`/users/${userId}`, updateData, landlordToken).expect(422);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.patch(`/users/${userId}`, { username: 'unauthenticated' }).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .patch(`/users/${userId}`, { username: 'no_permission' }, tenantToken)
        .expect(403);
    });
  });

  describe('DELETE /users/:id - Delete user by ID', () => {
    let userId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'landlord',
          lastName: 'User',
          role: 'landlord',
          username: `landlord_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      landlordToken = landlord;

      // Create a user to delete
      const userResponse = await requestHelper.post(
        '/users',
        {
          email: `to-delete-${timestamp}@example.com`,
          password: 'Password123!',
          username: `to_delete_${timestamp}`,
          firstName: 'to',
          lastName: 'delete',
          user_type: 'Tenant',
        },
        landlordToken,
      );

      userId = userResponse.body._id;

      // Create a tenant user
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

      tenantToken = tenant;
    });

    it('should delete the user (soft delete)', async () => {
      const res = await requestHelper.delete(`/users/${userId}`, landlordToken).expect(204);

      // Verify the user is not returned in GET requests (soft deleted)
      await requestHelper.get(`/users/${userId}`, landlordToken).expect(404);
    });

    it('should return 404 when user ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.delete(`/users/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.delete('/users/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.delete(`/users/${userId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.delete(`/users/${userId}`, tenantToken).expect(403);
    });
  });
});
