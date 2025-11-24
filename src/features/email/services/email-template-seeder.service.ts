import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as fs from 'fs';
import { Model } from 'mongoose';
import * as path from 'path';
import { EmailTemplate, EmailTemplateDocument } from '../schemas/email-template.schema';

interface TemplatePayload {
  name: string;
  html: string;
  subject: string;
  text?: string;
}

@Injectable()
export class EmailTemplateSeeder {
  private readonly logger = new Logger(EmailTemplateSeeder.name);

  constructor(
    @InjectModel(EmailTemplate.name)
    private readonly emailTemplateModel: Model<EmailTemplateDocument>,
  ) {}

  private getTemplatesDir(): string {
    return path.join(process.cwd(), 'src', 'features', 'email', 'templates');
  }

  private collectTemplateNames(): string[] {
    const templatesDir = this.getTemplatesDir();
    if (!fs.existsSync(templatesDir)) {
      this.logger.warn(`Templates directory not found: ${templatesDir}`);
      return [];
    }

    const files = fs.readdirSync(templatesDir);
    const names = new Set<string>();

    for (const file of files) {
      if (file.endsWith('.hbs')) {
        names.add(file.replace(/\.hbs$/, ''));
      }
      if (file.endsWith('.json')) {
        names.add(file.replace(/\.json$/, ''));
      }
    }

    return Array.from(names);
  }

  private loadTemplatePayloads(names: string[]): TemplatePayload[] {
    const templatesDir = this.getTemplatesDir();
    const payloads: TemplatePayload[] = [];

    for (const name of names) {
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

      payloads.push({ name, html, subject, text: text ?? undefined });
    }

    return payloads;
  }

  private async upsertTemplates(payloads: TemplatePayload[]): Promise<number> {
    let upserted = 0;
    for (const payload of payloads) {
      await this.emailTemplateModel
        .updateOne(
          { name: payload.name },
          {
            $set: {
              name: payload.name,
              subject: payload.subject,
              html: payload.html,
              text: payload.text,
            },
          },
          { upsert: true },
        )
        .exec();
      upserted += 1;
    }
    return upserted;
  }

  /**
   * Backfill all templates from disk into MongoDB. Safe and idempotent.
   */
  async backfillAll(): Promise<number> {
    const templateNames = this.collectTemplateNames();
    if (!templateNames.length) {
      this.logger.warn('No email templates discovered on disk; skipping backfill.');
      return 0;
    }

    const payloads = this.loadTemplatePayloads(templateNames);
    const upserted = await this.upsertTemplates(payloads);
    this.logger.log(`Email templates backfill completed. Upserted=${upserted}`);
    return upserted;
  }

  /**
   * Ensure templates exist; only backfill when any are missing.
   * Returns true when a backfill ran.
   */
  async backfillIfMissing(): Promise<boolean> {
    const templateNames = this.collectTemplateNames();
    if (!templateNames.length) {
      return false;
    }

    const existing = await this.emailTemplateModel
      .find({ name: { $in: templateNames } })
      .select('name')
      .lean()
      .exec();
    const existingNames = new Set(existing.map((doc) => doc.name));
    const missing = templateNames.filter((name) => !existingNames.has(name));

    if (!missing.length) {
      this.logger.log('Email templates already present in database; skipping backfill.');
      return false;
    }

    await this.backfillAll();
    return true;
  }
}
