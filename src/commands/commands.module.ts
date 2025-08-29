import { Module } from '@nestjs/common';
import { UsersModule } from '../features/users/users.module';
import { SeedAdminCommand } from './seed-admin.command';
import { SeedAllCommand } from './seed-all.command';
import { SeedersService } from './seeders.service';

@Module({
  imports: [UsersModule],
  providers: [SeedAdminCommand, SeedAllCommand, SeedersService],
})
export class CommandsModule {}