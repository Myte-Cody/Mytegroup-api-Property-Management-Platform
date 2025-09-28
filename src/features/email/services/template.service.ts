import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as handlebars from 'handlebars';
import * as path from 'path';
import { formatAddress } from '../../../common/utils/address-formatter';
import { formatCurrency } from '../../../common/utils/money';
import { capitalize } from '../../../common/utils/string';
import { EmailTemplate, TemplateContext } from '../interfaces/email.interface';

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);
  private readonly templatesCache = new Map<string, handlebars.TemplateDelegate>();
  private readonly templatesDir: string;

  constructor() {
    this.templatesDir = path.join(process.cwd(), 'src', 'features', 'email', 'templates');
    this.ensureTemplatesDirectory();
    this.registerHelpers();
  }

  private ensureTemplatesDirectory(): void {
    if (!fs.existsSync(this.templatesDir)) {
      fs.mkdirSync(this.templatesDir, { recursive: true });
      this.logger.log(`Created templates directory: ${this.templatesDir}`);
    }
  }

  private registerHelpers(): void {
    handlebars.registerHelper('formatDate', (date: Date) => {
      return date.toLocaleDateString();
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

  private async getTemplate(
    templateName: string,
  ): Promise<{ html: handlebars.TemplateDelegate; subject: string; text?: string }> {
    const cacheKey = templateName;

    if (!this.templatesCache.has(cacheKey)) {
      await this.loadTemplate(templateName);
    }

    const htmlTemplate = this.templatesCache.get(cacheKey);
    if (!htmlTemplate) {
      throw new Error(`Template ${templateName} not found`);
    }

    const configPath = path.join(this.templatesDir, `${templateName}.json`);
    let config = { subject: templateName, text: undefined };

    if (fs.existsSync(configPath)) {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      config = JSON.parse(configContent);
    }

    return {
      html: htmlTemplate,
      subject: config.subject,
      text: config.text,
    };
  }

  private async loadTemplate(templateName: string): Promise<void> {
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }

    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    const compiledTemplate = handlebars.compile(templateContent);

    this.templatesCache.set(templateName, compiledTemplate);
    this.logger.log(`Loaded template: ${templateName}`);
  }
}
