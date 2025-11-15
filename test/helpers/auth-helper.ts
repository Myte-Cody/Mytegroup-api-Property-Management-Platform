import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DatabaseHelper } from './database-helper';
import { RequestHelper } from './request-helper';

export class AuthHelper {
  private readonly jwtService: JwtService;
  private readonly dbHelper: DatabaseHelper;
  private readonly requestHelper: RequestHelper;

  constructor(private readonly app: INestApplication) {
    this.jwtService = app.get(JwtService);
    this.dbHelper = new DatabaseHelper(app);
    this.requestHelper = new RequestHelper(app);
  }

  async createUser(userData: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    role: string;
    username?: string;
    user_type?: string;
  }) {
    const hashedPassword = await bcrypt.hash(userData.password, 10);

    // Map role to user_type if not provided
    const user_type = userData.user_type || this.mapRoleToUserType(userData.role);
    const username = userData.username || `user_${Date.now()}`;

    const users = await this.dbHelper.seedCollection('User', [
      {
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role,
        username,
        user_type,
        isActive: true,
      },
    ]);

    return users[0];
  }

  private mapRoleToUserType(role: string): string {
    const map = {
      admin: 'Admin',
      landlord: 'Landlord',
      tenant: 'Tenant',
      contractor: 'Contractor',
    };

    return map[role] || 'Admin';
  }

  async login(email: string, password: string) {
    const response = await this.requestHelper.post('/auth/login', { email, password }).expect(201);

    return response.body.accessToken;
  }

  generateToken(userId: string, role: string) {
    return this.jwtService.sign({ sub: userId, role }, { expiresIn: '1h' });
  }

  async createAndLoginUser(role: string = 'admin') {
    const timestamp = Date.now();
    const user = await this.createUser({
      email: `test-${timestamp}@example.com`,
      password: 'Password123!',
      firstName: 'Test',
      lastName: 'User',
      role,
      username: `test_user_${timestamp}`,
      user_type: this.mapRoleToUserType(role),
    });

    // Cast user to any to access _id property from Mongoose document
    const token = this.generateToken((user as any)._id.toString(), role);

    return { user, token };
  }
}
