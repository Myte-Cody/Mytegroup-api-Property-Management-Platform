import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { User, UserSchema } from '../features/users/schemas/user.schema';
import { HealthController } from './health.controller';
import { SessionService } from './services/session.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Global()
@Module({
  imports: [PassportModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [HealthController],
  providers: [JwtStrategy, SessionService],
  exports: [PassportModule, SessionService],
})
export class CommonModule {}
