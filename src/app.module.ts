import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { BullBoardModule } from '@bull-board/nestjs';
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { CommonModule } from './common/common.module';
import configuration from './config/configuration';
import renewalConfig from './config/renewal.config';
import { AuthModule } from './features/auth/auth.module';
import { ContractorModule } from './features/contractors/contractor.module';
import { EmailModule } from './features/email/email.module';
import { InvitationsModule } from './features/invitations/invitations.module';
import { LandlordModule } from './features/landlords/landlord.module';
import { LeasesModule } from './features/leases/leases.module';
import { MediaModule } from './features/media/media.module';
import { PropertiesModule } from './features/properties/properties.module';
import { TenantsModule } from './features/tenants/tenant.module';
import { UsersModule } from './features/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration, renewalConfig],
      validate: (env: Record<string, any>) => {
        if (!env.DB_URL) throw new Error('DB_URL is required');
        if (!env.MONGO_DB_NAME) throw new Error('MONGO_DB_NAME is required');
        if (!env.JWT_SECRET) throw new Error('JWT_SECRET is required');
        return env;
      },
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
      },
    }),
    BullBoardModule.forRoot({
      route: '/admin/queues',
      adapter: ExpressAdapter,
    }),
    BullBoardModule.forFeature({
      name: 'email',
      adapter: BullMQAdapter,
    }),
    CommonModule,
    AuthModule,
    EmailModule,
    UsersModule,
    LandlordModule,
    TenantsModule,
    ContractorModule,
    InvitationsModule,
    PropertiesModule,
    LeasesModule,
    MediaModule,
    MongooseModule.forRoot(process.env.DB_URL, {
      dbName: process.env.MONGO_DB_NAME,
    }),
  ],
})
export class AppModule {}
