import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { UnitAvailabilityStatus, UnitType } from '../../../src/common/enums/unit.enum';
import { testPropertyForUnits, testUnit, testUnit2, testUnit3 } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Units (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let requestHelper: RequestHelper;
  let dbHelper: DatabaseHelper;
  let landlordToken: string;
  let tenantToken: string;
  let propertyId: string;
  let unitIds: string[] = [];

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
    await dbHelper.clearCollection('Unit');
    await dbHelper.clearCollection('Property');
    await dbHelper.clearCollection('User');
    await dbHelper.clearCollection('Media');
  });

  describe('GET /units - Get all units', () => {
    let unitIds: string[] = [];

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'Units',
          role: 'landlord',
          username: `landlord_units_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'Units',
          role: 'tenant',
          username: `tenant_units_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a test property
      const propertyResponse = await requestHelper
        .post('/properties', testPropertyForUnits, landlordToken)
        .expect(201);
      propertyId = propertyResponse.body.data.property._id;

      // Create test units
      const propertyObjectId = new Types.ObjectId(propertyId);
      const unitsData = [
        { ...testUnit, property: propertyObjectId },
        { ...testUnit2, property: propertyObjectId },
        { ...testUnit3, property: propertyObjectId },
      ];

      // Seed the units directly to the database
      const seededUnits = await dbHelper.seedCollection('Unit', unitsData);
      unitIds = seededUnits.map((unit) => unit._id.toString());
    });

    it('should return paginated list of units', async () => {
      const response = await requestHelper.get('/units', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter units by unit number', async () => {
      const response = await requestHelper
        .get(`/units?search=${encodeURIComponent(testUnit.unitNumber)}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].unitNumber).toBe(testUnit.unitNumber);
    });

    it('should filter units by property ID', async () => {
      const response = await requestHelper
        .get(`/units?propertyId=${propertyId}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
      for (const unit of response.body.data) {
        expect(unit.property._id).toBe(propertyId);
      }
    });

    it('should sort units by unit number (ascending)', async () => {
      const response = await requestHelper
        .get('/units?sortBy=unitNumber&sortOrder=asc', landlordToken)
        .expect(200);

      const unitNumbers = response.body.data.map((unit) => unit.unitNumber);
      const sortedUnitNumbers = [...unitNumbers].sort();
      expect(unitNumbers).toEqual(sortedUnitNumbers);
    });

    it('should sort units by size (descending)', async () => {
      const response = await requestHelper
        .get('/units?sortBy=size&sortOrder=desc', landlordToken)
        .expect(200);

      const sizes = response.body.data.map((unit) => unit.size);
      const sortedSizes = [...sizes].sort((a, b) => b - a);
      expect(sizes).toEqual(sortedSizes);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/units').expect(401);
    });

    it('should not allow tenants to view units that does not belong to him', async () => {
      await requestHelper.get('/units', tenantToken).expect(403);
    });
  });

  describe('GET /units/:id - Get unit by ID', () => {
    let unitId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'Units',
          role: 'landlord',
          username: `landlord_units_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'Units',
          role: 'tenant',
          username: `tenant_units_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a test property
      const propertyResponse = await requestHelper
        .post('/properties', testPropertyForUnits, landlordToken)
        .expect(201);
      propertyId = propertyResponse.body.data.property._id;

      // Create a test unit
      const propertyObjectId = new Types.ObjectId(propertyId);
      const unitData = { ...testUnit, property: propertyObjectId };

      // Seed the unit directly to the database
      const seededUnits = await dbHelper.seedCollection('Unit', [unitData]);
      unitId = seededUnits[0]._id.toString();
    });

    it('should return the unit with the specified ID', async () => {
      const response = await requestHelper.get(`/units/${unitId}`, landlordToken).expect(200);

      expect(response.body).toHaveProperty('_id', unitId);
      expect(response.body).toHaveProperty('unitNumber', testUnit.unitNumber);
      expect(response.body).toHaveProperty('size', testUnit.size);
      expect(response.body).toHaveProperty('type', testUnit.type);
      expect(response.body).toHaveProperty('availabilityStatus', testUnit.availabilityStatus);
      expect(response.body).toHaveProperty('property');
    });

    it('should include property information', async () => {
      const response = await requestHelper.get(`/units/${unitId}`, landlordToken).expect(200);

      expect(response.body.property).toBeDefined();
      expect(response.body.property._id).toBe(propertyId);
    });

    it('should return 404 when unit ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/units/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/units/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/units/${unitId}`).expect(401);
    });

    it('should allow tenants to view units', async () => {
      await requestHelper.get(`/units/${unitId}`, tenantToken).expect(200);
    });
  });

  describe('PATCH /units/:id - Update unit by ID', () => {
    let unitId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'Units',
          role: 'landlord',
          username: `landlord_units_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'Units',
          role: 'tenant',
          username: `tenant_units_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a test property
      const propertyResponse = await requestHelper
        .post('/properties', testPropertyForUnits, landlordToken)
        .expect(201);
      propertyId = propertyResponse.body.data.property._id;

      // Create a test unit
      const propertyObjectId = new Types.ObjectId(propertyId);
      const unitData = { ...testUnit, property: propertyObjectId };

      // Seed the unit directly to the database
      const seededUnits = await dbHelper.seedCollection('Unit', [unitData]);
      unitId = seededUnits[0]._id.toString();
    });

    it('should update the unit with modified fields', async () => {
      const updateData = {
        size: 1200,
      };

      const response = await requestHelper
        .patch(`/units/${unitId}`, updateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('size', updateData.size);
    });

    it('should update only the provided fields', async () => {
      // First, let's update the size
      const firstUpdateData = {
        size: 1300,
      };

      await requestHelper.patch(`/units/${unitId}`, firstUpdateData, landlordToken).expect(200);

      // Then update only the type
      const secondUpdateData = {
        type: UnitType.STUDIO,
      };

      const response = await requestHelper
        .patch(`/units/${unitId}`, secondUpdateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('type', UnitType.STUDIO);
      expect(response.body).toHaveProperty('size', 1300); // Should remain at the updated value
      expect(response.body).toHaveProperty('unitNumber', testUnit.unitNumber); // Should remain unchanged
    });

    it('should return 404 when unit ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .patch(`/units/${nonExistentId}`, { size: 1500 }, landlordToken)
        .expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper
        .patch('/units/invalid-id', { description: 'Test' }, landlordToken)
        .expect(400);
    });

    it('should return 400 when update data is empty', async () => {
      await requestHelper.patch(`/units/${unitId}`, {}, landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.patch(`/units/${unitId}`, { description: 'Test' }).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper
        .patch(`/units/${unitId}`, { description: 'Test' }, tenantToken)
        .expect(403);
    });
  });

  describe('DELETE /units/:id - Delete unit by ID', () => {
    let unitId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);
      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'Units',
          role: 'landlord',
          username: `landlord_units_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-units-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'Units',
          role: 'tenant',
          username: `tenant_units_${timestamp}`,
          user_type: 'Tenant',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'tenant'),
        }));

      landlordToken = landlord;
      tenantToken = tenant;

      // Create a test property
      const propertyResponse = await requestHelper
        .post('/properties', testPropertyForUnits, landlordToken)
        .expect(201);
      propertyId = propertyResponse.body.data.property._id;

      // Create a test unit
      const propertyObjectId = new Types.ObjectId(propertyId);
      const unitData = { ...testUnit, property: propertyObjectId };

      // Seed the unit directly to the database
      const seededUnits = await dbHelper.seedCollection('Unit', [unitData]);
      unitId = seededUnits[0]._id.toString();
    });

    it('should delete the unit (soft delete)', async () => {
      await requestHelper.delete(`/units/${unitId}`, landlordToken).expect(204);

      // Verify the unit is not returned in GET requests (soft deleted)
      await requestHelper.get(`/units/${unitId}`, landlordToken).expect(404);
    });

    it('should return 404 when unit ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.delete(`/units/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.delete('/units/invalid-id', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.delete(`/units/${unitId}`).expect(401);
    });

    it('should return 403 when user does not have permission', async () => {
      await requestHelper.delete(`/units/${unitId}`, tenantToken).expect(403);
    });
  });

  describe('GET /units/stats/overview - Get units overview statistics', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-stats-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'Stats',
          role: 'landlord',
          username: `landlord_stats_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-stats-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'Stats',
          role: 'tenant',
          username: `tenant_stats_${timestamp}`,
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
        testPropertyForUnits,
        landlordToken,
      );
      propertyId = propertyResponse.body.data.property._id;

      // Create multiple units with different statuses
      const unit1Response = await requestHelper.post(
        `/properties/${propertyId}/units`,
        { ...testUnit, availabilityStatus: UnitAvailabilityStatus.VACANT },
        landlordToken,
      );
      unitIds.push(unit1Response.body.data.unit._id);

      const unit2Response = await requestHelper.post(
        `/properties/${propertyId}/units`,
        { ...testUnit2, availabilityStatus: UnitAvailabilityStatus.OCCUPIED },
        landlordToken,
      );
      unitIds.push(unit2Response.body.data.unit._id);

      const unit3Response = await requestHelper.post(
        `/properties/${propertyId}/units`,
        { ...testUnit3, availabilityStatus: UnitAvailabilityStatus.AVAILABLE_FOR_RENT },
        landlordToken,
      );
      unitIds.push(unit3Response.body.data.unit._id);
    });

    it('should return overview statistics for all units', async () => {
      const response = await requestHelper.get('/units/stats/overview', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('availableUnits');
      expect(response.body.data).toHaveProperty('occupancyRate');
      expect(response.body.data).toHaveProperty('occupiedUnits');
      expect(response.body.data).toHaveProperty('totalMonthlyRevenue');
      expect(response.body.data).toHaveProperty('totalUnits');
    });

    it('should calculate occupancy rate correctly', async () => {
      const response = await requestHelper.get('/units/stats/overview', landlordToken).expect(200);

      const { totalUnits, occupiedUnits, occupancyRate } = response.body;

      if (totalUnits > 0) {
        const expectedRate = (occupiedUnits / totalUnits) * 100;
        expect(Math.abs(occupancyRate - expectedRate)).toBeLessThan(0.01);
      }
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get('/units/stats/overview').expect(401);
    });
  });

  describe('GET /units/:id/stats - Get unit statistics', () => {
    let unitId: string;

    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const timestamp = Date.now() + Math.floor(Math.random() * 10000);

      const { token: landlord } = await authHelper
        .createUser({
          email: `landlord-unitstats-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Landlord',
          lastName: 'UnitStats',
          role: 'landlord',
          username: `landlord_unitstats_${timestamp}`,
          user_type: 'Landlord',
        })
        .then((user) => ({
          user,
          token: authHelper.generateToken((user as any)._id.toString(), 'landlord'),
        }));

      const { token: tenant } = await authHelper
        .createUser({
          email: `tenant-unitstats-${timestamp}@example.com`,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'UnitStats',
          role: 'tenant',
          username: `tenant_unitstats_${timestamp}`,
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
        testPropertyForUnits,
        landlordToken,
      );
      propertyId = propertyResponse.body.data.property._id;

      // Create a unit
      const unitResponse = await requestHelper.post(
        `/properties/${propertyId}/units`,
        testUnit,
        landlordToken,
      );
      unitId = unitResponse.body.data.unit._id;
    });

    it('should return statistics for a specific unit', async () => {
      const response = await requestHelper.get(`/units/${unitId}/stats`, landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('currentBalance');
      expect(response.body.data).toHaveProperty('lastPaymentDate');
      expect(response.body.data).toHaveProperty('maintenanceRequestsCount');
      expect(response.body.data).toHaveProperty('nextPaymentDue');
      expect(response.body.data).toHaveProperty('unitId');
      expect(response.body.data).toHaveProperty('ytdRevenue');
    });

    it('should return 404 when unit ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/units/${nonExistentId}/stats`, landlordToken).expect(404);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/units/invalid-id/stats', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/units/${unitId}/stats`).expect(401);
    });
  });
});
