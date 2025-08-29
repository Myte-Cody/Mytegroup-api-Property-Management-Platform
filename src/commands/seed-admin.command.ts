import { Command, CommandRunner } from 'nest-commander';
import { Injectable } from '@nestjs/common';
import { UsersService } from '../features/users/users.service';
import { CreateUserDto } from '../features/users/dto/create-user.dto';

@Injectable()
@Command({ name: 'seed:admin', description: 'Create admin user' })
export class SeedAdminCommand extends CommandRunner {
  constructor(private readonly usersService: UsersService) {
    super();
  }

  async run(): Promise<void> {
    try {
      console.log('🌱 Starting admin user seeding...');

      const adminData: CreateUserDto = {
        username: process.env.ADMIN_USERNAME || 'admin',
        email: process.env.ADMIN_EMAIL || 'aaadmin@example.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        isAdmin: true,
      };

      // Check if admin already exists
      const existingAdmin = await this.usersService.findByEmail(adminData.email);
      
      if (existingAdmin) {
        console.log(`✅ Admin user already exists: ${adminData.email}`);
        return;
      }

      // Create admin user
      const admin = await this.usersService.create(adminData);
      
      console.log(`✅ Admin user created successfully!`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Username: ${admin.username}`);
      console.log(`   Admin: ${admin.isAdmin}`);
      
    } catch (error) {
      console.error('❌ Error seeding admin user:', error.message);
      process.exit(1);
    }
  }
}