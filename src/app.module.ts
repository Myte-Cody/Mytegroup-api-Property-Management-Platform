import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthorizationModule } from './common/authorization/authorization.module';
import { CommonModule } from './common/common.module';
import { AuthModule } from './features/auth/auth.module';
import { EmailModule } from './features/email/email.module';
import { OrganizationsModule } from './features/organizations/organizations.module';
import { PropertiesModule } from './features/properties/properties.module';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // makes env variables available everywhere
    }),
    CommonModule,
    AuthModule,
    EmailModule,
    OrganizationsModule,
    UsersModule,
    PropertiesModule,
    AuthorizationModule,
    MongooseModule.forRoot(process.env.DB_URL),
  ],
})
export class AppModule {}
