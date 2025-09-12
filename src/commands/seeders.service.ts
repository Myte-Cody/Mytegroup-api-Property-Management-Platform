import { Injectable } from '@nestjs/common';
import { SeedDevDataCommand } from './seed-dev-data.command';


@Injectable()
export class SeedersService {
  constructor(
    private readonly seedDevDataCommand: SeedDevDataCommand,
  ) {}

  async runAll(): Promise<void> {
    console.log('🌱 Starting all seeders...\n');

    const seeders = [
      { name: 'Dev Data Seeder', command: this.seedDevDataCommand },
    ];

    for (const seeder of seeders) {
      try {
        console.log(`📦 Running ${seeder.name}...`);
        await seeder.command.run([]);
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
      dev: this.seedDevDataCommand,
    };

    const seeder = seederMap[seederName];
    if (!seeder) {
      throw new Error(`Seeder '${seederName}' not found. Available: ${Object.keys(seederMap).join(', ')}`);
    }

    console.log(`🌱 Running ${seederName} seeder...`);
    await seeder.run([]);
  }
}