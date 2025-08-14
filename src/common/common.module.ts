import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { User, UserSchema } from '../features/users/schemas/user.schema';
import { HealthController } from './health.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])],
  controllers: [HealthController],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class CommonModule {}
