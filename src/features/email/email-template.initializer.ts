import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmailTemplateSeeder } from './services/email-template-seeder.service';

@Injectable()
export class EmailTemplateInitializer implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateInitializer.name);

  constructor(private readonly seeder: EmailTemplateSeeder) {}

  async onModuleInit(): Promise<void> {
    // Avoid touching the filesystem in production; templates should be managed via migrations/CI.
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      this.logger.log('Skipping email template seeding in production environment.');
      return;
    }
    try {
      await this.seeder.backfillIfMissing();
    } catch (error) {
      this.logger.error('Failed to ensure email templates are loaded', error as Error);
    }
  }
}
