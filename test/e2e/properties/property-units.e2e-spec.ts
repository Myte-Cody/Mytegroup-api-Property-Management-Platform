import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { testPropertyForUnits, testUnit, testUnit2, testUnit3 } from '../../fixtures/units';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Property Units (e2e)', () => {
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
    await dbHelper.clearCollection('Unit');
    await dbHelper.clearCollection('Property');
    await dbHelper.clearCollection('User');
  });

  describe('Properties Units (e2e)', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions with unique timestamps
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

      // Create a test property with a unique name
      const propertyResponse = await requestHelper
        .post('/properties', testPropertyForUnits, landlordToken)
        .expect(201);
      propertyId = propertyResponse.body.data.property._id;

      // Seed units directly using database helper
      const propertyObjectId = new Types.ObjectId(propertyId);

      // Prepare unit data with property reference
      const unitsData = [
        { ...testUnit, property: propertyObjectId },
        { ...testUnit2, property: propertyObjectId },
        { ...testUnit3, property: propertyObjectId },
      ];

      // Seed the units directly to the database
      const seededUnits = await dbHelper.seedCollection('Unit', unitsData);
      unitIds = seededUnits.map((unit) => unit._id.toString());
    });
    it('should return paginated list of units for the specified property', async () => {
      const response = await requestHelper
        .get(`/properties/${propertyId}/units`, landlordToken)
        .expect(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);

      // Verify that all returned units belong to the specified property
      for (const unit of response.body.data) {
        expect(unit.property._id).toBe(propertyId);
      }
    });

    it('should filter units by unit number', async () => {
      // Use search parameter instead of filters[unitNumber] based on the implementation
      const response = await requestHelper
        .get(
          `/properties/${propertyId}/units?search=${encodeURIComponent(testUnit.unitNumber)}`,
          landlordToken,
        )
        .expect(200);

      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.data[0].unitNumber).toBe(testUnit.unitNumber);
    });

    it('should sort units by unit number (ascending)', async () => {
      const response = await requestHelper
        .get(`/properties/${propertyId}/units?sortBy=unitNumber&sortOrder=asc`, landlordToken)
        .expect(200);

      const unitNumbers = response.body.data.map((unit) => unit.unitNumber);
      const sortedUnitNumbers = [...unitNumbers].sort();
      expect(unitNumbers).toEqual(sortedUnitNumbers);
    });

    it('should sort units by size (descending)', async () => {
      const response = await requestHelper
        .get(`/properties/${propertyId}/units?sortBy=size&sortOrder=desc`, landlordToken)
        .expect(200);

      const sizes = response.body.data.map((unit) => unit.size);
      const sortedSizes = [...sizes].sort((a, b) => b - a);
      expect(sizes).toEqual(sortedSizes);
    });

    // The API doesn't return 404 for non-existent properties, it just returns an empty array
    it('should return empty results when property ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const response = await requestHelper
        .get(`/properties/${nonExistentId}/units`, landlordToken)
        .expect(200);

      expect(response.body.data).toHaveLength(0);
      expect(response.body.total).toBe(0);
    });

    it('should return 400 when ID format is invalid', async () => {
      await requestHelper.get('/properties/invalid-id/units', landlordToken).expect(400);
    });

    it('should return 401 when not authenticated', async () => {
      await requestHelper.get(`/properties/${propertyId}/units`).expect(401);
    });

    it('should not allow tenants to view units that does not belong to him', async () => {
      await requestHelper.get(`/properties/${propertyId}/units`, tenantToken).expect(403);
    });
  });
});
