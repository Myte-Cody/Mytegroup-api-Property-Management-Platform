import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import { landlordUser } from '../../fixtures/users';
import { AuthHelper } from '../../helpers/auth-helper';
import { DatabaseHelper } from '../../helpers/database-helper';
import { RequestHelper } from '../../helpers/request-helper';
import { createTestApp } from '../../test-app';

describe('Email verification (e2e)', () => {
  let app: INestApplication;
  let authHelper: AuthHelper;
  let dbHelper: DatabaseHelper;
  let requestHelper: RequestHelper;

  beforeAll(async () => {
    app = await createTestApp();
    authHelper = new AuthHelper(app);
    dbHelper = new DatabaseHelper(app);
    requestHelper = new RequestHelper(app);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/verify-email/request', () => {
    it('should create a verification token when requested by email for an unverified user', async () => {
      const timestamp = Date.now();
      const email = `verify-${timestamp}@example.com`;

      // Seed a basic landlord user without emailVerifiedAt
      const user = await authHelper.createUser({
        ...landlordUser,
        email,
        username: `verify_user_${timestamp}`,
      });

      const response = await requestHelper
        .post('/auth/verify-email/request', { email })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);

      const VerificationModel = dbHelper.getModel<any>('VerificationToken');
      const tokens = await VerificationModel.find({ userId: (user as any)._id }).lean().exec();

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].used).toBe(false);
    });

    it('should allow an authenticated user to request verification without providing email', async () => {
      const timestamp = Date.now();
      const email = `verify-auth-${timestamp}@example.com`;

      const user = await authHelper.createUser({
        ...landlordUser,
        email,
        username: `verify_auth_user_${timestamp}`,
      });

      const token = authHelper.generateToken((user as any)._id.toString(), user.role);

      const response = await requestHelper.post('/auth/verify-email/request', {}, token).expect(201);

      expect(response.body).toHaveProperty('success', true);

      const VerificationModel = dbHelper.getModel<any>('VerificationToken');
      const tokens = await VerificationModel.find({ userId: (user as any)._id }).lean().exec();

      expect(tokens.length).toBeGreaterThan(0);
      expect(tokens[0].used).toBe(false);
    });
  });

  describe('POST /auth/verify-email/confirm', () => {
    it('should verify email and mark token as used when confirming with a valid token', async () => {
      const timestamp = Date.now();
      const email = `verify-token-${timestamp}@example.com`;

      const user = await authHelper.createUser({
        ...landlordUser,
        email,
        username: `verify_token_user_${timestamp}`,
      });

      const rawToken = 'test-verification-token';
      const tokenHash = await argon2.hash(rawToken, { type: argon2.argon2id });
      const codeHash = await argon2.hash('123456', { type: argon2.argon2id });
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      const VerificationModel = dbHelper.getModel<any>('VerificationToken');
      await VerificationModel.insertMany([
        {
          userId: (user as any)._id,
          tokenHash,
          codeHash,
          expiresAt,
          used: false,
        },
      ]);

      const response = await requestHelper
        .post('/auth/verify-email/confirm', { token: rawToken })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', email);
      expect(response.body.user).toHaveProperty('emailVerifiedAt');
      expect(response.body.user.emailVerifiedAt).not.toBeNull();

      const UserModel = dbHelper.getModel<any>('User');
      const updatedUser = await UserModel.findById((user as any)._id).lean().exec();
      expect(updatedUser.emailVerifiedAt).toBeDefined();

      const updatedToken = await VerificationModel.findOne({
        userId: (user as any)._id,
      })
        .lean()
        .exec();
      expect(updatedToken?.used).toBe(true);
      expect(updatedToken?.usedAt).toBeDefined();
    });

    it('should return 401 for an invalid verification token', async () => {
      const response = await requestHelper
        .post('/auth/verify-email/confirm', { token: 'invalid-token' })
        .expect(401);

      expect(response.body).toHaveProperty('message');
    });
  });
});
