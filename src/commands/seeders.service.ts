import { Injectable } from '@nestjs/common';
import { SeedAdminCommand } from './seed-admin.command';

@Injectable()
export class SeedersService {
  constructor(
    private readonly seedAdminCommand: SeedAdminCommand,
  ) {}

  async runAll(): Promise<void> {
    console.log('🌱 Starting all seeders...\n');

    const seeders = [
      { name: 'Admin User Seeder', command: this.seedAdminCommand },
      // Add future seeders here
    ];

    for (const seeder of seeders) {
      try {
        console.log(`📦 Running ${seeder.name}...`);
        await seeder.command.run();
        console.log(`✅ ${seeder.name} completed\n`);
      } catch (error) {
        console.error(`❌ ${seeder.name} failed:`, error.message);
        throw error;
      }
    }

    console.log('🎉 All seeders completed successfully!');
  }

  async runSpecific(seederName: string): Promise<void> {
    const seederMap = {
      admin: this.seedAdminCommand,
      // Add future seeders here
    };

    const seeder = seederMap[seederName];
    if (!seeder) {
      throw new Error(`Seeder '${seederName}' not found. Available: ${Object.keys(seederMap).join(', ')}`);
    }

    console.log(`🌱 Running ${seederName} seeder...`);
    await seeder.run();
  }
}