import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { createTestLease } from '../../fixtures/leases';
import { createTestProperty } from '../../fixtures/properties';
import { testTenant } from '../../fixtures/tenants';
import {
  createRentTransactionData,
  createSecurityDepositTransactionData,
  markTransactionAsPaidData,
  updateTransactionData,
} from '../../fixtures/transactions';
import { createTestUnit } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Transactions (e2e)', () => {
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
  let transactionId: string;

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
    await dbHelper.clearCollection('Transaction');
    await dbHelper.clearCollection('Lease');
    await dbHelper.clearCollection('Unit');
    await dbHelper.clearCollection('Property');
    await dbHelper.clearCollection('Tenant');
    await dbHelper.clearCollection('User');
    await dbHelper.clearCollection('RentalPeriod');
  });

  describe('GET /transactions - Get all transactions', () => {
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

      // Create transactions for testing
      const rentTransaction = createRentTransactionData(timestamp, leaseId);
      const securityDepositTransaction = createSecurityDepositTransactionData(timestamp, leaseId);

      await requestHelper.post('/transactions', rentTransaction, landlordToken);
      await requestHelper.post('/transactions', securityDepositTransaction, landlordToken);
    });

    it('should return paginated list of transactions', async () => {
      const response = await requestHelper.get('/transactions', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter transactions by type', async () => {
      const response = await requestHelper
        .get('/transactions?type=RENT', landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      response.body.data.forEach((transaction) => {
        expect(transaction.type).toBe('RENT');
      });
    });

    it('should filter transactions by lease ID', async () => {
      const response = await requestHelper
        .get(`/transactions?leaseId=${leaseId}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(2);
      response.body.data.forEach((transaction) => {
        expect(transaction.lease._id).toBe(leaseId);
      });
    });

    it('should sort transactions by amount', async () => {
      const response = await requestHelper
        .get('/transactions?sortBy=amount&sortOrder=desc', landlordToken)
        .expect(200);

      const amounts = response.body.data.map((transaction) => transaction.amount);
      const sortedAmounts = [...amounts].sort((a, b) => b - a); // Sort descending

      expect(amounts).toEqual(sortedAmounts);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/transactions').expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get('/transactions', tenantToken).expect(403);
    });
  });

  describe('GET /transactions/:id - Get transaction by ID', () => {
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

      // Create a transaction for testing
      const transactionResponse = await requestHelper.post(
        '/transactions',
        createRentTransactionData(timestamp, leaseId),
        landlordToken,
      );
      transactionId = transactionResponse.body._id;
    });

    it('should return the transaction with the specified ID', async () => {
      const response = await requestHelper
        .get(`/transactions/${transactionId}`, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('_id', transactionId);
      expect(response.body).toHaveProperty('lease._id', leaseId);
      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('amount');
    });

    it('should return 404 when transaction ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/transactions/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/transactions/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/transactions/${transactionId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.get(`/transactions/${transactionId}`, tenantToken).expect(403);
    });
  });

  describe('POST /transactions - Create a new transaction', () => {
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

    it('should create a new transaction', async () => {
      const timestamp = Date.now();
      const newTransaction = createRentTransactionData(timestamp, leaseId);

      const response = await requestHelper
        .post('/transactions', newTransaction, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body).toHaveProperty('lease', leaseId);
      expect(response.body).toHaveProperty('type', newTransaction.type);
      expect(response.body).toHaveProperty('amount', newTransaction.amount);
    });

    it('should return 400 when required fields are missing', async () => {
      const invalidTransaction = {
        // Missing required fields
        amount: 1200,
      };

      await requestHelper.post('/transactions', invalidTransaction, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      const newTransaction = createRentTransactionData(Date.now(), leaseId);
      await requestHelper.post('/transactions', newTransaction).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      const newTransaction = createRentTransactionData(Date.now(), leaseId);
      await requestHelper.post('/transactions', newTransaction, tenantToken).expect(403);
    });
  });
  describe('PATCH /transactions/:id - Update transaction details', () => {
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

      // Create a transaction for testing
      const transactionResponse = await requestHelper.post(
        '/transactions',
        createRentTransactionData(timestamp, leaseId),
        landlordToken,
      );
      transactionId = transactionResponse.body._id;
    });

    it('should update the transaction with modified fields', async () => {
      const response = await requestHelper
        .patch(`/transactions/${transactionId}`, updateTransactionData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('_id', transactionId);
      expect(response.body).toHaveProperty('amount', updateTransactionData.amount);
      expect(response.body).toHaveProperty('notes', updateTransactionData.notes);
    });

    it('should return 404 when transaction ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .patch(`/transactions/${nonExistentId}`, updateTransactionData, landlordToken)
        .expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper
        .patch('/transactions/invalid-id', updateTransactionData, landlordToken)
        .expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper
        .patch(`/transactions/${transactionId}`, updateTransactionData)
        .expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .patch(`/transactions/${transactionId}`, updateTransactionData, tenantToken)
        .expect(403);
    });
  });

  describe('POST /transactions/:id/process - Process a pending transaction', () => {
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

      // Create a transaction for testing
      const transactionResponse = await requestHelper.post(
        '/transactions',
        createRentTransactionData(timestamp, leaseId),
        landlordToken,
      );
      transactionId = transactionResponse.body._id;
    });

    it('should process a pending transaction', async () => {
      const response = await requestHelper
        .post(`/transactions/${transactionId}/process`, {}, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('_id', transactionId);
      expect(response.body).toHaveProperty('status', 'PENDING');
    });

    it('should return 404 when transaction ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .post(`/transactions/${nonExistentId}/process`, {}, landlordToken)
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.post(`/transactions/${transactionId}/process`, {}).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .post(`/transactions/${transactionId}/process`, {}, tenantToken)
        .expect(403);
    });
  });

  describe('DELETE /transactions/:id - Delete a transaction', () => {
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

      // Create a transaction for testing
      const transactionResponse = await requestHelper.post(
        '/transactions',
        createRentTransactionData(timestamp, leaseId),
        landlordToken,
      );
      transactionId = transactionResponse.body._id;
    });

    it('should delete a pending transaction', async () => {
      await requestHelper.delete(`/transactions/${transactionId}`, landlordToken).expect(204);
    });

    it('should return 404 when transaction ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.delete(`/transactions/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.delete(`/transactions/${transactionId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.delete(`/transactions/${transactionId}`, tenantToken).expect(403);
    });
  });

  describe('POST /transactions/:id/mark-as-paid - Mark a transaction as paid', () => {
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

      // Create a transaction for testing
      const transactionResponse = await requestHelper.post(
        '/transactions',
        createRentTransactionData(timestamp, leaseId),
        landlordToken,
      );
      transactionId = transactionResponse.body._id;
    });

    it('should mark a transaction as paid', async () => {
      const response = await requestHelper
        .post(
          `/transactions/${transactionId}/mark-as-paid`,
          markTransactionAsPaidData,
          landlordToken,
        )
        .expect(201);

      expect(response.body).toHaveProperty('_id', transactionId);
      expect(response.body).toHaveProperty('status', 'PAID');
      expect(response.body).toHaveProperty(
        'paymentMethod',
        markTransactionAsPaidData.paymentMethod,
      );
    });

    it('should return 404 when transaction ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .post(
          `/transactions/${nonExistentId}/mark-as-paid`,
          markTransactionAsPaidData,
          landlordToken,
        )
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper
        .post(`/transactions/${transactionId}/mark-as-paid`, markTransactionAsPaidData)
        .expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .post(`/transactions/${transactionId}/mark-as-paid`, markTransactionAsPaidData, tenantToken)
        .expect(403);
    });
  });

  describe('POST /transactions/:id/mark-as-not-paid - Mark a transaction as not paid', () => {
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

      // Create a transaction and mark it as paid
      const transactionResponse = await requestHelper.post(
        '/transactions',
        createRentTransactionData(timestamp, leaseId),
        landlordToken,
      );
      transactionId = transactionResponse.body._id;

      // Mark the transaction as paid
      await requestHelper.post(
        `/transactions/${transactionId}/mark-as-paid`,
        markTransactionAsPaidData,
        landlordToken,
      );
    });

    it('should mark a paid transaction as not paid', async () => {
      const response = await requestHelper
        .post(`/transactions/${transactionId}/mark-as-not-paid`, {}, landlordToken)
        .expect(201);

      expect(response.body).toHaveProperty('_id', transactionId);
      expect(response.body).toHaveProperty('status', 'PENDING');
      expect(response.body).not.toHaveProperty('paymentMethod');
      expect(response.body).not.toHaveProperty('paymentDate');
      expect(response.body).not.toHaveProperty('paymentReference');
    });

    it('should return 404 when transaction ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .post(`/transactions/${nonExistentId}/mark-as-not-paid`, {}, landlordToken)
        .expect(404);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.post(`/transactions/${transactionId}/mark-as-not-paid`, {}).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .post(`/transactions/${transactionId}/mark-as-not-paid`, {}, tenantToken)
        .expect(403);
    });
  });
});
