import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Landlord, LandlordSchema } from '../landlords/schema/landlord.schema';
import { Session, SessionSchema } from './schemas/session.schema';
import { PasswordReset, PasswordResetSchema } from './schemas/password-reset.schema';
import { VerificationToken, VerificationTokenSchema } from './schemas/verification-token.schema';
import { AuthEmailService } from '../email/services/auth-email.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Landlord.name, schema: LandlordSchema },
      { name: Session.name, schema: SessionSchema },
      { name: PasswordReset.name, schema: PasswordResetSchema },
      { name: VerificationToken.name, schema: VerificationTokenSchema },
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'super-secret-key',
        signOptions: { expiresIn: configService.get<string>('auth.jwtExpiration') || '15m' },
      }),
    }),
  ],
  providers: [AuthService, AuthEmailService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
