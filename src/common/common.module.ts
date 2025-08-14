import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { HealthController } from './health.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule],
  controllers: [HealthController],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class CommonModule {}
