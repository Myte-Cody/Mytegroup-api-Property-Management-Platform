import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from './common/common.module';
import configuration from './config/configuration';
import { AuthModule } from './features/auth/auth.module';
import { EmailModule } from './features/email/email.module';
import { PropertiesModule } from './features/properties/properties.module';
import { UsersModule } from './features/users/users.module';
import { TenantsModule } from './features/tenants/tenant.module';
import { ContractorModule } from './features/contractors/contractor.module';
import { LandlordModule } from './features/landlords/landlord.module';
import { MediaModule } from './features/media/media.module';

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
    UsersModule,
    LandlordModule,
    TenantsModule,
    ContractorModule,
    PropertiesModule,
    MediaModule,
    MongooseModule.forRoot(process.env.DB_URL, {
      dbName: process.env.MONGO_DB_NAME,
    }),
  ],
})
export class AppModule {}
