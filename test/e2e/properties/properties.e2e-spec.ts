import { INestApplication } from '@nestjs/common';
import { Types } from 'mongoose';
import { testProperty, testPropertyWithoutDescription } from '../../fixtures/properties';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Properties (e2e)', () => {
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
    await dbHelper.clearCollection('Property');
    await dbHelper.clearCollection('User');
  });

  describe('Creating Properties', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const { token: landlord } = await authHelper.createAndLoginUser('landlord');
      const { token: tenant } = await authHelper.createAndLoginUser('tenant');
      landlordToken = landlord;
      tenantToken = tenant;
    });
    it('should create a property with description', async () => {
      const response = await requestHelper
        .post('/properties', testProperty, landlordToken)
        .expect(201);

      // Verify the response has the expected structure
      if (response.body.data && response.body.data.property) {
        const property = response.body.data.property;
        expect(property).toHaveProperty('_id');
        expect(property).toHaveProperty('name', testProperty.name);
        expect(property.address).toMatchObject({
          street: testProperty.street,
          city: testProperty.city,
          state: testProperty.state,
          postalCode: testProperty.postalCode,
          country: testProperty.country,
        });
        expect(property).toHaveProperty('description', testProperty.description);
      }
    });

    it('should create a property without description', async () => {
      const response = await requestHelper
        .post('/properties', testPropertyWithoutDescription, landlordToken)
        .expect(201);

      // Verify the response has the expected structure
      if (response.body.data && response.body.data.property) {
        const property = response.body.data.property;
        expect(property).toHaveProperty('_id');
        expect(property).toHaveProperty('name', testPropertyWithoutDescription.name);
        expect(property.address).toMatchObject({
          street: testPropertyWithoutDescription.street,
          city: testPropertyWithoutDescription.city,
          state: testPropertyWithoutDescription.state,
          postalCode: testPropertyWithoutDescription.postalCode,
          country: testPropertyWithoutDescription.country,
        });
        expect(property.description).toBeFalsy();
      }
    });

    it('should fail when not authenticated', async () => {
      await requestHelper.post('/properties', testProperty).expect(401);
    });

    it('should fail when user does not have permission', async () => {
      await requestHelper.post('/properties', testProperty, tenantToken).expect(403);
    });

    it('should fail with validation errors when required fields are missing', async () => {
      const invalidProperty = {
        name: 'Test Property',
        // Missing required address fields
      };

      const response = await requestHelper
        .post('/properties', invalidProperty, landlordToken)
        .expect(400);
      expect(response.body).toHaveProperty('message');
      expect(Array.isArray(response.body.message)).toBeTruthy();
    });

    it('should fail when property name already exists', async () => {
      // Try to create another property with the same name
      await requestHelper.post('/properties', testProperty, landlordToken).expect(201);
      await requestHelper.post('/properties', testProperty, landlordToken).expect(422);
    });
  });

  describe('Getting Properties', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const { token: landlord } = await authHelper.createAndLoginUser('landlord');
      const { token: tenant } = await authHelper.createAndLoginUser('tenant');
      landlordToken = landlord;
      tenantToken = tenant;
      // Create two records for testing
      await requestHelper.post('/properties', testProperty, landlordToken);
      await requestHelper.post('/properties', testPropertyWithoutDescription, landlordToken);
    });

    it('should get all properties with pagination', async () => {
      const response = await requestHelper.get('/properties', landlordToken).expect(200);

      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('page');
      expect(response.body).toHaveProperty('limit');
    });

    it('should search properties by name', async () => {
      const response = await requestHelper
        .get(`/properties?search=${encodeURIComponent(testProperty.name)}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].name).toContain(testProperty.name);
    });

    it('should filter properties by city', async () => {
      const response = await requestHelper
        .get(`/properties?filters[city]=${encodeURIComponent(testProperty.city)}`, landlordToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0].address.city).toBe(testProperty.city);
    });

    it('should fail when not authenticated', async () => {
      await requestHelper.get('/properties').expect(401);
    });
  });

  describe('Getting Property by ID', () => {
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const { token: landlord } = await authHelper.createAndLoginUser('landlord');
      const { token: tenant } = await authHelper.createAndLoginUser('tenant');
      landlordToken = landlord;
      tenantToken = tenant;
    });
    it('should get property by ID', async () => {
      const response = await requestHelper
        .post('/properties', testProperty, landlordToken)
        .expect(201);
      const createdPropertyId = response.body.data.property._id;
      const response2 = await requestHelper
        .get(`/properties/${createdPropertyId}`, landlordToken)
        .expect(200);

      expect(response2.body).toHaveProperty('_id', createdPropertyId);
      expect(response2.body).toHaveProperty('name', testProperty.name);
    });

    it('should fail when property ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.get(`/properties/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should fail with invalid ID format', async () => {
      await requestHelper.get('/properties/invalid-id', landlordToken).expect(400);
    });

    it('should fail when not authenticated', async () => {
      const response = await requestHelper
        .post('/properties', testProperty, landlordToken)
        .expect(201);
      const createdPropertyId = response.body.data.property._id;
      await requestHelper.get(`/properties/${createdPropertyId}`).expect(401);
    });
  });

  describe('Updating Property', () => {
    let createdPropertyId: string;
    beforeEach(async () => {
      // Create users with different roles for testing permissions
      const { token: landlord } = await authHelper.createAndLoginUser('landlord');
      const { token: tenant } = await authHelper.createAndLoginUser('tenant');
      landlordToken = landlord;
      tenantToken = tenant;
    });
    it('should update property details', async () => {
      const newRecord = await requestHelper
        .post('/properties', testProperty, landlordToken)
        .expect(201);
      createdPropertyId = newRecord.body.data.property._id;
      const updateData = {
        name: 'Updated Property Name',
        description: 'Updated property description',
      };

      const response = await requestHelper
        .patch(`/properties/${createdPropertyId}`, updateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('name', updateData.name);
      expect(response.body).toHaveProperty('description', updateData.description);
    });

    it('should partially update property', async () => {
      const newRecord = await requestHelper
        .post('/properties', testProperty, landlordToken)
        .expect(201);
      createdPropertyId = newRecord.body.data.property._id;
      const updateData = {
        description: 'Another description update',
      };

      const response = await requestHelper
        .patch(`/properties/${createdPropertyId}`, updateData, landlordToken)
        .expect(200);

      expect(response.body).toHaveProperty('description', updateData.description);
    });

    it('should fail when property ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper
        .patch(`/properties/${nonExistentId}`, { name: 'Test' }, landlordToken)
        .expect(404);
    });

    it('should fail with invalid ID format', async () => {
      await requestHelper
        .patch('/properties/invalid-id', { name: 'Test' }, landlordToken)
        .expect(400);
    });

    it('should fail when not authenticated', async () => {
      await requestHelper.patch(`/properties/${createdPropertyId}`, { name: 'Test' }).expect(401);
    });

    it('should fail when user does not have permission', async () => {
      await requestHelper
        .patch(`/properties/${createdPropertyId}`, { name: 'Test' }, tenantToken)
        .expect(403);
    });
  });

  describe('Deleting Property', () => {
    let propertyToDeleteId: string;
    beforeEach(async () => {
      const { token: landlord } = await authHelper.createAndLoginUser('landlord');
      const { token: tenant } = await authHelper.createAndLoginUser('tenant');
      landlordToken = landlord;
      tenantToken = tenant;
      // Create a new property to delete
      const newProperty = {
        name: `Property to Delete ${Date.now()}`,
        street: '789 Delete St',
        city: 'Delete City',
        state: 'DS',
        postalCode: '12345',
        country: 'Delete Country',
      };

      const response = await requestHelper
        .post('/properties', newProperty, landlordToken)
        .expect(201);

      propertyToDeleteId = response.body.data.property._id;
    });

    it('should delete a property', async () => {
      await requestHelper.delete(`/properties/${propertyToDeleteId}`, landlordToken).expect(204);

      // Verify it's deleted (should return 404)
      await requestHelper.get(`/properties/${propertyToDeleteId}`, landlordToken).expect(404);
    });

    it('should fail when property ID does not exist', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      await requestHelper.delete(`/properties/${nonExistentId}`, landlordToken).expect(404);
    });

    it('should fail with invalid ID format', async () => {
      await requestHelper.delete('/properties/invalid-id', landlordToken).expect(400);
    });

    it('should fail when not authenticated', async () => {
      const response = await requestHelper
        .post(
          '/properties',
          {
            name: 'Another Property',
            street: '123 Another St',
            city: 'Another City',
            state: 'AS',
            postalCode: '54321',
            country: 'Another Country',
          },
          landlordToken,
        )
        .expect(201);

      const anotherPropertyId = response.body.data.property._id;

      await requestHelper.delete(`/properties/${anotherPropertyId}`).expect(401);
    });

    it('should fail when user does not have permission', async () => {
      const response = await requestHelper
        .post(
          '/properties',
          {
            name: 'Yet Another Property',
            street: '123 Yet Another St',
            city: 'Yet Another City',
            state: 'YA',
            postalCode: '98765',
            country: 'Yet Another Country',
          },
          landlordToken,
        )
        .expect(201);

      const yetAnotherPropertyId = response.body.data.property._id;

      await requestHelper.delete(`/properties/${yetAnotherPropertyId}`, tenantToken).expect(403);
    });
  });
});
