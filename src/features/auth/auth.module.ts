import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import type { StringValue } from 'ms';
import { Contractor, ContractorSchema } from '../contractors/schema/contractor.schema';
import { AuthEmailService } from '../email/services/auth-email.service';
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { Tenant, TenantSchema } from '../tenants/schema/tenant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordReset, PasswordResetSchema } from './schemas/password-reset.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { VerificationToken, VerificationTokenSchema } from './schemas/verification-token.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Landlord.name, schema: LandlordSchema },
      { name: Tenant.name, schema: TenantSchema },
      { name: Contractor.name, schema: ContractorSchema },
      { name: Session.name, schema: SessionSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: VerificationToken.name, schema: VerificationTokenSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secret-key',
        signOptions: {
          expiresIn: (configService.get<string>('auth.jwtExpiration') || '15m') as StringValue,
        },
      }),
    }),
  ],
  providers: [AuthService, AuthEmailService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
