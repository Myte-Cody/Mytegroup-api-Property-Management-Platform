import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import {
  EntityType,
  InvitationStatus,
} from '../../../src/features/invitations/schemas/invitation.schema';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Invitations (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let requestHelper: RequestHelper;
  let dbHelper: DatabaseHelper;
  let landlordToken: string;
  let tenantToken: string;
  let invitationId: string;
  let invitationToken: string;

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
    await dbHelper.clearCollection('Invitation');
    await dbHelper.clearCollection('User');
  });

  describe('POST /invitations - Create a new invitation', () => {
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

    it('should create a new invitation', async () => {
      const timestamp = Date.now();
      const newInvitation = {
        entityType: EntityType.TENANT,
        email: `invited-tenant-${timestamp}@example.com`,
        entityData: {
          propertyId: new Types.ObjectId().toString(),
          notes: 'Test invitation',
        },
      };

      const response = await requestHelper
        .post('/invitations', newInvitation, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('entityType', newInvitation.entityType);
      expect(response.body).toHaveProperty('email', newInvitation.email);
      expect(response.body).toHaveProperty('entityData');
      expect(response.body).toHaveProperty('invitationToken');
      expect(response.body).toHaveProperty('status', InvitationStatus.PENDING);
      expect(response.body).toHaveProperty('expiresAt');

      // Save for later tests
      invitationId = response.body._id;
      invitationToken = response.body.invitationToken;
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidInvitation = {
        // Missing required field: entityType
        email: 'test@example.com',
      };

      await requestHelper.post('/invitations', invalidInvitation, landlordToken).expect(400);
    });

    it('should return 400 when field validations fail', async () => {
      const invalidInvitation = {
        entityType: EntityType.TENANT,
        email: 'invalid-email', // Invalid email format
      };

      await requestHelper.post('/invitations', invalidInvitation, landlordToken).expect(400);
    });

    it('should return 400 when invalid entity type is provided', async () => {
      const invalidInvitation = {
        entityType: 'invalid-entity-type',
        email: 'test@example.com',
      };

      await requestHelper.post('/invitations', invalidInvitation, landlordToken).expect(400);
    });

    it('should return 422 when an active invitation already exists for the email', async () => {
      const timestamp = Date.now();
      const email = `duplicate-${timestamp}@example.com`;

      // Create first invitation
      const invitation = {
        entityType: EntityType.TENANT,
        email,
      };

      await requestHelper.post('/invitations', invitation, landlordToken).expect(201);

      // Try to create another invitation with the same email
      await requestHelper.post('/invitations', invitation, landlordToken).expect(422);
    });

    it('should return 401 when not authenticated', async () => {
      const newInvitation = {
        entityType: EntityType.TENANT,
        email: 'test@example.com',
      };

      await requestHelper.post('/invitations', newInvitation).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      const newInvitation = {
        entityType: EntityType.TENANT,
        email: 'test@example.com',
      };

      await requestHelper.post('/invitations', newInvitation, tenantToken).expect(403);
    });
  });

  describe('GET /invitations - Get all invitations', () => {
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

      // Create multiple invitations for testing pagination and filtering
      const invitation1 = {
        entityType: EntityType.TENANT,
        email: `tenant-invitation-${timestamp}@example.com`,
      };

      const invitation2 = {
        entityType: EntityType.CONTRACTOR,
        email: `contractor-invitation-${timestamp}@example.com`,
      };

      await requestHelper.post('/invitations', invitation1, landlordToken);
      await requestHelper.post('/invitations', invitation2, landlordToken);
    });

    it('should return paginated list of invitations', async () => {
      const response = await requestHelper.get('/invitations', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter invitations by email', async () => {
      const timestamp = Date.now();
      const email = `specific-email-${timestamp}@example.com`;

      // Create a specific invitation to search for
      const specificInvitation = {
        entityType: EntityType.TENANT,
        email,
      };

      await requestHelper.post('/invitations', specificInvitation, landlordToken);

      // Search for the specific invitation
      const response = await requestHelper
        .get(`/invitations?search=${email}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].email).toBe(email);
    });

    it('should filter invitations by entity type', async () => {
      const response = await requestHelper
        .get(`/invitations?entityType=${EntityType.TENANT}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((invitation) => {
        expect(invitation.entityType).toBe(EntityType.TENANT);
      });
    });

    it('should filter invitations by status', async () => {
      const response = await requestHelper
        .get(`/invitations?status=${InvitationStatus.PENDING}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((invitation) => {
        expect(invitation.status).toBe(InvitationStatus.PENDING);
      });
    });

    it('should sort invitations by creation date', async () => {
      const response = await requestHelper
        .get('/invitations?sortBy=createdAt&sortOrder=desc', landlordToken)
        .expect(200);

      const dates = response.body.data.map((invitation) =>
        new Date(invitation.createdAt).getTime(),
      );
      const sortedDates = [...dates].sort((a, b) => b - a); // Sort descending

      expect(dates).toEqual(sortedDates);
    });

    it('should sort invitations by expiration date', async () => {
      const response = await requestHelper
        .get('/invitations?sortBy=expiresAt&sortOrder=asc', landlordToken)
        .expect(200);

      const dates = response.body.data.map((invitation) =>
        new Date(invitation.expiresAt).getTime(),
      );
      const sortedDates = [...dates].sort((a, b) => a - b); // Sort ascending

      expect(dates).toEqual(sortedDates);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/invitations').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get('/invitations', tenantToken).expect(403);
    });
  });

  describe('GET /invitations/:token/validate - Validate invitation token', () => {
    let validToken: string;

    beforeEach(async () => {
      // Create a user with landlord role
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

      landlordToken = landlord;

      // Create an invitation to get a valid token
      const invitation = {
        entityType: EntityType.TENANT,
        email: `validate-token-${timestamp}@example.com`,
      };

      const response = await requestHelper.post('/invitations', invitation, landlordToken);
      validToken = response.body.invitationToken;
    });

    it('should validate a valid token', async () => {
      const response = await requestHelper.get(`/invitations/${validToken}/validate`).expect(200);

      expect(response.body).toHaveProperty('valid', true);
      expect(response.body).toHaveProperty('invitation');
      expect(response.body.invitation).toHaveProperty('entityType', EntityType.TENANT);
      expect(response.body.invitation).toHaveProperty('email');
      expect(response.body.invitation).toHaveProperty('expiresAt');
    });

    it('should return 404 when token does not exist', async () => {
      const nonExistentToken = 'non-existent-token';

      await requestHelper.get(`/invitations/${nonExistentToken}/validate`).expect(404);
    });

    // Note: Testing expired and revoked tokens would require manipulating the database directly
    // or waiting for tokens to expire, which is not practical in e2e tests.
    // These cases are better tested in unit tests.
  });

  describe('POST /invitations/:token/accept - Accept an invitation', () => {
    let validToken: string;

    beforeEach(async () => {
      // Create a user with landlord role
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

      landlordToken = landlord;

      // Create an invitation to get a valid token
      const invitation = {
        entityType: EntityType.TENANT,
        email: `accept-token-${timestamp}@example.com`,
      };

      const response = await requestHelper.post('/invitations', invitation, landlordToken);
      validToken = response.body.invitationToken;
    });

    it('should accept a valid invitation', async () => {
      const acceptData = {
        name: 'Test Tenant',
        username: 'test_tenant',
        password: 'Password123!',
        phoneNumber: '123-456-7890',
      };

      const response = await requestHelper
        .post(`/invitations/${validToken}/accept`, acceptData)
        .expect(201);

      expect(response.body).toHaveProperty('entity');
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
      expect(response.body.entity).toHaveProperty('name', acceptData.name);
    });

    it('should return 404 when token does not exist', async () => {
      const nonExistentToken = 'non-existent-token';
      const acceptData = {
        name: 'Test Tenant',
        username: 'test_tenant',
        password: 'Password123!',
      };

      await requestHelper.post(`/invitations/${nonExistentToken}/accept`, acceptData).expect(404);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidAcceptData = {
        // Missing required fields: name, username, password
        phoneNumber: '123-456-7890',
      };

      await requestHelper.post(`/invitations/${validToken}/accept`, invalidAcceptData).expect(400);
    });

    it('should return 400 when field validations fail', async () => {
      const invalidAcceptData = {
        name: 'Test Tenant',
        username: 'te', // Too short
        password: 'pass', // Too short
      };

      await requestHelper.post(`/invitations/${validToken}/accept`, invalidAcceptData).expect(400);
    });

    // Note: Testing expired, revoked, and already accepted tokens would require
    // manipulating the database directly, which is better handled in unit tests.
  });

  describe('PATCH /invitations/:id/revoke - Revoke an invitation', () => {
    let invitationId: string;

    beforeEach(async () => {
      // Create a user with landlord role
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

      // Create an invitation to revoke
      const invitation = {
        entityType: EntityType.TENANT,
        email: `revoke-invitation-${timestamp}@example.com`,
      };

      const response = await requestHelper.post('/invitations', invitation, landlordToken);
      invitationId = response.body._id;
    });

    it('should revoke an invitation', async () => {
      const response = await requestHelper
        .patch(`/invitations/${invitationId}/revoke`, {}, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Invitation revoked successfully');
    });

    it('should return 404 when invitation ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();

      await requestHelper
        .patch(`/invitations/${nonExistentId}/revoke`, {}, landlordToken)
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.patch(`/invitations/${invitationId}/revoke`, {}).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.patch(`/invitations/${invitationId}/revoke`, {}, tenantToken).expect(403);
    });

    // Note: Testing already accepted and already expired invitations would require
    // manipulating the database directly, which is better handled in unit tests.
  });

  describe('DELETE /invitations/:id - Delete an invitation', () => {
    let invitationId: string;

    beforeEach(async () => {
      // Create a user with landlord role
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

      // Create an invitation to delete
      const invitation = {
        entityType: EntityType.TENANT,
        email: `delete-invitation-${timestamp}@example.com`,
      };

      const response = await requestHelper.post('/invitations', invitation, landlordToken);
      invitationId = response.body._id;
    });

    it('should delete an invitation', async () => {
      const response = await requestHelper
        .delete(`/invitations/${invitationId}`, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Invitation deleted successfully');
    });

    it('should return 404 when invitation ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();

      await requestHelper.delete(`/invitations/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.delete(`/invitations/${invitationId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.delete(`/invitations/${invitationId}`, tenantToken).expect(403);
    });
  });
});
