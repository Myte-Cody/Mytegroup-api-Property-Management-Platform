import { Injectable } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SeedersService } from './seeders.service';

interface SeedAllOptions {
  seeder?: string;
}

@Injectable()
@Command({
  name: 'seed:all',
  description: 'Run all database seeders or a specific seeder',
})
export class SeedAllCommand extends CommandRunner {
  constructor(private readonly seedersService: SeedersService) {
    super();
  }

  async run(passedParam: string[], options?: SeedAllOptions): Promise<void> {
    try {
      // Check for SEEDER environment variable or command option
      const seeder = process.env.SEEDER || options?.seeder;

      if (seeder) {
        await this.seedersService.runSpecific(seeder);
      } else {
        await this.seedersService.runAll();
      }
    } catch (error) {
      console.error('❌ Seeding failed:', error.message);
      process.exit(1);
    }
  }

  @Option({
    flags: '-s, --seeder <seeder>',
    description: 'Run a specific seeder (e.g., admin)',
  })
  parseSeeder(val: string): string {
    return val;
  }
}
