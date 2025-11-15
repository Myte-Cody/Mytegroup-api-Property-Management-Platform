import { INestApplication } from '@nestjs/common';
import { landlordUser } from '../../fixtures/users';
import { AuthHelper } from '../../helpers/auth-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let requestHelper: RequestHelper;

  beforeAll(async () => {
    app = await createTestApp();
    authHelper = new AuthHelper(app);
    requestHelper = new RequestHelper(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/login', () => {
    beforeEach(async () => {
      await authHelper.createUser(landlordUser);
    });

    it('should authenticate user and return JWT token', async () => {
      const response = await requestHelper
        .post('/auth/login', {
          email: landlordUser.email,
          password: landlordUser.password,
        })
        .expect(201);

      expect(response.body).toHaveProperty('accessToken');
      expect(typeof response.body.accessToken).toBe('string');
    });

    it('should fail with invalid credentials', async () => {
      await requestHelper
        .post('/auth/login', {
          email: landlordUser.email,
          password: 'wrong-password',
        })
        .expect(401);
    });
  });

  describe('GET /auth/me', () => {
    let token: string;

    beforeEach(async () => {
      const user = await authHelper.createUser(landlordUser);
      token = authHelper.generateToken((user as any)._id.toString(), user.role);
    });

    it('should return user profile when authenticated', async () => {
      const response = await requestHelper.get('/auth/me', token).expect(200);

      expect(response.body).toHaveProperty('email', landlordUser.email);
      expect(response.body).toHaveProperty('username', landlordUser.username);
      expect(response.body).toHaveProperty('user_type', landlordUser.user_type);
    });

    it('should fail when not authenticated', async () => {
      await requestHelper.get('/auth/me').expect(401);
    });
  });
});
