import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { CommonModule } from './common/common.module';
import configuration from './config/configuration';
import { AuthModule } from './features/auth/auth.module';
import { EmailModule } from './features/email/email.module';
import { OrganizationsModule } from './features/organizations/organizations.module';
import { PropertiesModule } from './features/properties/properties.module';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: (env: Record<string, any>) => {
        if (!env.DB_URL) throw new Error('DB_URL is required');
        if (!env.MONGO_DB_NAME) throw new Error('MONGO_DB_NAME is required');
        if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');
        return env;
      },
    }),
    CommonModule,
    AuthModule,
    EmailModule,
    OrganizationsModule,
    UsersModule,
    PropertiesModule,
    AuthorizationModule,
    MongooseModule.forRoot(process.env.DB_URL, {
      dbName: process.env.MONGO_DB_NAME,
    }),
  ],
})
export class AppModule {}
