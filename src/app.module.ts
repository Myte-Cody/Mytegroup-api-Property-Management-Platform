import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from './common/common.module';
import { AuthModule } from './features/auth/auth.module';
import { EmailModule } from './features/email/email.module';
import { OrganizationsModule } from './features/organizations/organizations.module';
import { PropertiesModule } from './features/properties/properties.module';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    CommonModule,
    AuthModule,
    EmailModule,
    OrganizationsModule,
    UsersModule,
    PropertiesModule,
    MongooseModule.forRoot(process.env.DB_URL),
  ],
})
export class AppModule {}
