import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { Model } from 'mongoose';
import { Command, CommandRunner } from 'nest-commander';
import { UserRole } from '../common/enums/user-role.enum';
import { UserType } from '../common/enums/user-type.enum';
import { User } from '../features/users/schemas/user.schema';

@Injectable()
@Command({
  name: 'seed:admin',
  description: 'Seed admin user for the platform',
})
export class SeedAdminCommand extends CommandRunner {
  constructor(@InjectModel(User.name) private readonly userModel: Model<User>) {
    super();
  }

  async run(): Promise<void> {
    try {
      console.log('🔐 Seeding admin user...\n');

      // Check if admin already exists
      const existingAdmin = await this.userModel.findOne({ email: 'admin@example.com' });

      if (existingAdmin) {
        console.log('ℹ️  Admin user already exists, skipping...');
        console.log(`   Email: ${existingAdmin.email}`);
        return;
      }

      const hashedPassword = await bcrypt.hash('password123', 10);

      const adminUser = new this.userModel({
        username: 'admin',
        firstName: 'System',
        lastName: 'Admin',
        email: 'admin@example.com',
        password: hashedPassword,
        phone: '+1000000000',
        user_type: UserType.ADMIN,
        role: UserRole.SUPER_ADMIN,
        isPrimary: true,
        emailVerifiedAt: new Date(),
      });

      await adminUser.save();

      console.log('✅ Admin user created successfully!');
      console.log('\n📝 Login credentials:');
      console.log('   Email: admin@example.com');
      console.log('   Password: password123');
    } catch (error) {
      console.error('❌ Admin seeding failed:', error.message);
      if (error.stack) console.error(error.stack);
      process.exit(1);
    }
  }
}
