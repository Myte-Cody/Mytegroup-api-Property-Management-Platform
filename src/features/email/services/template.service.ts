import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import * as handlebars from 'handlebars';
import { Model } from 'mongoose';
import { formatAddress } from '../../../common/utils/address-formatter';
import { formatCurrency } from '../../../common/utils/money';
import { capitalize } from '../../../common/utils/string';
import { TemplateContext } from '../interfaces/email.interface';
import { EmailTemplate, EmailTemplateDocument } from '../schemas/email-template.schema';

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

    // Comparison helpers
    handlebars.registerHelper('gt', (a: any, b: any) => {
      return a > b;
    });

    handlebars.registerHelper('lt', (a: any, b: any) => {
      return a < b;
    });

    handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    handlebars.registerHelper('gte', (a: any, b: any) => {
      return a >= b;
    });

    handlebars.registerHelper('lte', (a: any, b: any) => {
      return a <= b;
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

  private async getTemplate(templateName: string): Promise<CompiledTemplate> {
    const cached = this.templatesCache.get(templateName);

    if (cached) {
      return cached;
    }

    const templateDoc = await this.emailTemplateModel.findOne({ name: templateName }).lean().exec();

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
