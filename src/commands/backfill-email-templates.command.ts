import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Command, CommandRunner } from 'nest-commander';
import * as fs from 'fs';
import * as path from 'path';
import { Model } from 'mongoose';
import { EmailTemplate, EmailTemplateDocument } from '../features/email/schemas/email-template.schema';

@Injectable()
@Command({
  name: 'email-templates:backfill',
  description:
    'Backfill email templates from src/features/email/templates into MongoDB. Safe and idempotent.',
})
export class BackfillEmailTemplatesCommand extends CommandRunner {
  private readonly logger = new Logger(BackfillEmailTemplatesCommand.name);

  constructor(
    @InjectModel(EmailTemplate.name)
    private readonly emailTemplateModel: Model<EmailTemplateDocument>,
  ) {
    super();
  }

  async run(): Promise<void> {
    const templatesDir = path.join(process.cwd(), 'src', 'features', 'email', 'templates');

    if (!fs.existsSync(templatesDir)) {
      this.logger.warn(`Templates directory not found: ${templatesDir}`);
      return;
    }

    const files = fs.readdirSync(templatesDir);
    const templateNames = new Set<string>();

    for (const file of files) {
      if (file.endsWith('.hbs')) {
        templateNames.add(file.replace(/\.hbs$/, ''));
      }
      if (file.endsWith('.json')) {
        templateNames.add(file.replace(/\.json$/, ''));
      }
    }

    if (!templateNames.size) {
      this.logger.warn(`No template files found in ${templatesDir}`);
      return;
    }

    this.logger.log(`Found ${templateNames.size} email templates. Starting backfill...`);

    let upserted = 0;

    for (const name of templateNames) {
      const htmlPath = path.join(templatesDir, `${name}.hbs`);
      const jsonPath = path.join(templatesDir, `${name}.json`);

      if (!fs.existsSync(htmlPath)) {
        this.logger.warn(`Skipping template "${name}" because HTML file is missing (${htmlPath})`);
        continue;
      }

      const html = fs.readFileSync(htmlPath, 'utf-8');

      let subject = name;
      let text: string | undefined;

      if (fs.existsSync(jsonPath)) {
        try {
          const configContent = fs.readFileSync(jsonPath, 'utf-8');
          const config = JSON.parse(configContent);
          subject = config.subject || subject;
          text = config.text;
        } catch (error) {
          this.logger.error(`Failed to read config for template "${name}"`, error as Error);
        }
      }

      await this.emailTemplateModel
        .updateOne(
          { name },
          {
            $set: {
              name,
              subject,
              html,
              text: text ?? undefined,
            },
          },
          { upsert: true },
        )
        .exec();

      upserted += 1;
      this.logger.log(`Upserted email template "${name}"`);
    }

    this.logger.log(`Email templates backfill completed. Upserted=${upserted}`);
  }
}

