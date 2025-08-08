import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { AuthModule } from './features/auth/auth.module';
import { EmailModule } from './features/email/email.module';
import { OrganizationsModule } from './features/organizations/organizations.module';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [CommonModule, AuthModule, EmailModule, OrganizationsModule, UsersModule],
})
export class AppModule {}
