import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as handlebars from 'handlebars';
import { Model } from 'mongoose';
import { formatAddress } from '../../../common/utils/address-formatter';
import { formatCurrency } from '../../../common/utils/money';
import { capitalize } from '../../../common/utils/string';
import { TemplateContext } from '../interfaces/email.interface';
import { EmailTemplate, EmailTemplateDocument } from '../schemas/email-template.schema';
import { EmailTemplateSeeder } from './email-template-seeder.service';

interface CompiledTemplate {
  html: handlebars.TemplateDelegate;
  subject: string;
  text?: string;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templatesCache = new Map<string, CompiledTemplate>();

  constructor(
    @InjectModel(EmailTemplate.name)
    private readonly emailTemplateModel: Model<EmailTemplateDocument>,
    private readonly emailTemplateSeeder: EmailTemplateSeeder,
  ) {
    this.registerHelpers();
  }

  private registerHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date) => {
      return date?.toLocaleDateString();
    });

    handlebars.registerHelper('formatCurrency', (amount: number) => {
      return formatCurrency(amount);
    });

    handlebars.registerHelper('capitalize', (str: string) => {
      return capitalize(str);
    });

    handlebars.registerHelper('formatAddress', (address: any) => {
      return formatAddress(address);
    });

    handlebars.registerHelper('currentYear', () => {
      return new Date().getFullYear();
    });

    handlebars.registerHelper('fallback', (value: any, defaultValue: any) => {
      return value || defaultValue;
    });

    handlebars.registerHelper('gt', (a: any, b: any) => {
      const left = typeof a === 'number' ? a : parseFloat(String(a));
      const right = typeof b === 'number' ? b : parseFloat(String(b));
      if (Number.isNaN(left) || Number.isNaN(right)) {
        return false;
      }
      return left > right;
    });

    // Shared base layout for product-branded emails
    handlebars.registerPartial(
      'base-email',
      `<html>
  <head>
    <meta charset='utf-8' />
    <meta name='viewport' content='width=device-width, initial-scale=1.0' />
    <title>{{brandName}}</title>
  </head>
  <body style='margin:0;padding:0;background-color:#020617;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;'>
    <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%' style='background-color:#0f172a;padding:32px 16px;'>
      <tr>
        <td align='center'>
          <table role='presentation' cellspacing='0' cellpadding='0' border='0' width='100%' style='max-width:640px;background-color:#020617;border-radius:16px;border:1px solid rgba(148,163,184,0.25);overflow:hidden;'>
            <tr>
              <td style='padding:20px 24px 16px 24px;border-bottom:1px solid rgba(148,163,184,0.25);background:radial-gradient(circle at top,#0ea5e9 0,transparent 55%),radial-gradient(circle at bottom,#22c55e 0,transparent 55%);background-color:#020617;'>
                <table role='presentation' width='100%' border='0' cellspacing='0' cellpadding='0'>
                  <tr>
                    <td align='left' style='color:#e5e7eb;font-size:13px;line-height:1.4;'>
                      <div style='display:flex;align-items:center;gap:12px;'>
                        {{#if brandLogoUrl}}
                          <span style='display:inline-block;padding:4px;border-radius:12px;background-color:rgba(15,23,42,0.75);border:1px solid rgba(148,163,184,0.4);'>
                            <img src='{{brandLogoUrl}}' alt='{{brandName}}' style='max-height:32px;border-radius:8px;display:block;' />
                          </span>
                        {{/if}}
                        <div>
                          <div style='text-transform:uppercase;letter-spacing:0.18em;font-size:10px;color:#cbd5f5;'>{{brandName}}</div>
                          <div style='font-size:13px;color:#e5e7eb;margin-top:2px;'>Notifications from your workspace</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style='padding:24px 24px 16px 24px;color:#e5e7eb;background-color:#020617;'>
                {{> @partial-block}}
              </td>
            </tr>
            <tr>
              <td style='padding:16px 24px 20px 24px;border-top:1px solid rgba(31,41,55,0.9);background-color:#020617;color:#6b7280;font-size:11px;line-height:1.5;'>
                <p style='margin:0 0 4px 0;'>
                  You&apos;re receiving this because your email is associated with an account on {{brandName}}.
                </p>
                <p style='margin:0;'>
                  c {{currentYear}} {{brandName}}. All rights reserved.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
    );
  }

  async compileTemplate(
    templateName: string,
    context: TemplateContext,
  ): Promise<{ html: string; subject: string; text?: string }> {
    try {
      const template = await this.getTemplate(templateName);
      const compiledHtml = template.html(context);
      const compiledSubject = handlebars.compile(template.subject)(context);
      const compiledText = template.text ? handlebars.compile(template.text)(context) : undefined;

      return {
        html: compiledHtml,
        subject: compiledSubject,
        text: compiledText,
      };
    } catch (error) {
      this.logger.error(`Failed to compile template ${templateName}`, error);
      throw error;
    }
  }

  private async getTemplate(templateName: string): Promise<CompiledTemplate> {
    const cached = this.templatesCache.get(templateName);

    if (cached) {
      return cached;
    }

    let templateDoc = await this.emailTemplateModel.findOne({ name: templateName }).lean().exec();

    if (!templateDoc) {
      // Attempt to backfill templates from disk when one is missing.
      // This ensures code-bundled templates like "verify-email" are
      // created at runtime if they are not yet present in the database.
      try {
        await this.emailTemplateSeeder.backfillIfMissing();
        templateDoc = await this.emailTemplateModel.findOne({ name: templateName }).lean().exec();
      } catch (error) {
        this.logger.error(
          `Failed to backfill email templates when loading ${templateName}`,
          error as Error,
        );
      }
    }

    if (!templateDoc) {
      throw new Error(`Email template not found in database: ${templateName}`);
    }

    const compiledHtml = handlebars.compile(templateDoc.html);

    const compiledTemplate: CompiledTemplate = {
      html: compiledHtml,
      subject: templateDoc.subject,
      text: templateDoc.text,
    };

    this.templatesCache.set(templateName, compiledTemplate);
    this.logger.log(`Loaded email template from database: ${templateName}`);

    return compiledTemplate;
  }
}
