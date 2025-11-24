import { Injectable, Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { EmailTemplateSeeder } from '../features/email/services/email-template-seeder.service';

@Injectable()
@Command({
  name: 'email-templates:backfill',
  description:
    'Backfill email templates from src/features/email/templates into MongoDB. Safe and idempotent.',
})
export class BackfillEmailTemplatesCommand extends CommandRunner {
  private readonly logger = new Logger(BackfillEmailTemplatesCommand.name);

  constructor(
    private readonly seeder: EmailTemplateSeeder,
  ) {
    super();
  }

  async run(): Promise<void> {
    const upserted = await this.seeder.backfillAll();
    this.logger.log(`Email templates backfill completed. Upserted=${upserted}`);
  }
}
