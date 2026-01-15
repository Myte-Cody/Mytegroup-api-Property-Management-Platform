import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as Handlebars from 'handlebars';
import * as path from 'path';
import * as puppeteer from 'puppeteer';
import { Browser } from 'puppeteer';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { MediaService } from '../../media/services/media.service';
import { User } from '../../users/schemas/user.schema';
import { Lease } from '../schemas/lease.schema';

export interface LeasePdfContext {
  leaseId: string;
  landlordName: string;
  landlordAddress?: string;
  tenantName: string;
  tenantEmail: string;
  propertyName: string;
  propertyAddress: string;
  unitNumber: string;
  startDate: Date;
  endDate: Date;
  rentAmount: number;
  paymentCycle: string;
  securityDeposit?: number;
  terms?: string;
  generatedAt: Date;
  // Signature fields (only for signed version)
  signedAt?: Date;
  signatureName?: string;
  signatureData?: string;
  signatureIp?: string;
}

@Injectable()
export class LeasePdfService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LeasePdfService.name);
  private browser: Browser | null = null;
  private templateCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor(
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    private readonly mediaService: MediaService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.registerHandlebarsHelpers();
  }

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
    }
    return this.browser;
  }

  private registerHandlebarsHelpers() {
    Handlebars.registerHelper('formatDate', (date: Date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    Handlebars.registerHelper('formatDateTime', (date: Date) => {
      if (!date) return '';
      const d = new Date(date);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
      });
    });

    Handlebars.registerHelper('formatCurrency', (amount: number) => {
      if (amount === undefined || amount === null) return '';
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    });

    Handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });
  }

  private formatAddress(address: any): string {
    if (!address) return '';
    if (typeof address === 'string') return address;
    const parts = [
      address.street,
      address.city,
      address.state,
      address.postalCode,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  }

  async generatePreviewPdf(leaseId: string): Promise<Buffer> {
    this.logger.log(`Generating preview PDF for lease ${leaseId}`);
    const context = await this.buildPdfContext(leaseId);
    return this.renderPdfFromTemplate('lease-agreement', context);
  }

  async generateAndStorePdf(
    leaseId: string,
    signatureData: {
      signedAt: Date;
      signatureName: string;
      signatureImageData?: string;
      signatureIp: string;
    },
    currentUser: User | null,
  ): Promise<{ mediaId: string; pdfHash: string }> {
    this.logger.log(`Generating signed PDF for lease ${leaseId}`);

    const context = await this.buildPdfContext(leaseId);
    context.signedAt = signatureData.signedAt;
    context.signatureName = signatureData.signatureName;
    context.signatureData = signatureData.signatureImageData;
    context.signatureIp = signatureData.signatureIp;

    const pdfBuffer = await this.renderPdfFromTemplate('lease-agreement', context);
    const pdfHash = this.generateHash(pdfBuffer);

    // Store via MediaService
    const lease = await this.leaseModel.findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const file = {
      buffer: pdfBuffer,
      originalname: `lease-${leaseId}-signed.pdf`,
      mimetype: 'application/pdf',
      size: pdfBuffer.length,
    };

    // Create a system user context for internal operations
    const systemUser =
      currentUser ||
      ({
        _id: lease.landlord,
        landlord: lease.landlord,
      } as unknown as User);

    const media = await this.mediaService.upload(
      file,
      lease,
      systemUser,
      'signed_contracts',
      undefined,
      'Lease',
      undefined,
      { skipPermissionCheck: true }, // Internal system operation
    );

    this.logger.log(`Signed PDF stored with media ID ${media._id}`);

    return { mediaId: media._id.toString(), pdfHash };
  }

  generateHash(content: Buffer | string): string {
    const data = typeof content === 'string' ? content : content.toString('base64');
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  generateLeaseContentHash(lease: Lease): string {
    // Hash key lease fields to detect changes
    const contentToHash = JSON.stringify({
      tenant: lease.tenant?.toString(),
      unit: lease.unit?.toString(),
      startDate: lease.startDate,
      endDate: lease.endDate,
      rentAmount: lease.rentAmount,
      paymentCycle: lease.paymentCycle,
      terms: lease.terms,
      securityDepositAmount: lease.securityDepositAmount,
    });
    return crypto.createHash('sha256').update(contentToHash).digest('hex');
  }

  private async buildPdfContext(leaseId: string): Promise<LeasePdfContext> {
    const lease = await this.leaseModel
      .findById(leaseId)
      .populate({
        path: 'unit',
        populate: { path: 'property' },
      })
      .populate('tenant')
      .populate('landlord')
      .exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const unit = lease.unit as any;
    const property = unit?.property as any;
    const tenant = lease.tenant as any;
    const landlord = lease.landlord as any;

    return {
      leaseId: lease._id.toString(),
      landlordName: landlord?.name || landlord?.organizationName || 'Property Manager',
      landlordAddress: this.formatAddress(landlord?.address || property?.address),
      tenantName: tenant?.name || 'Tenant',
      tenantEmail: tenant?.email || '',
      propertyName: property?.name || 'Property',
      propertyAddress: this.formatAddress(property?.address),
      unitNumber: unit?.unitNumber || '',
      startDate: lease.startDate,
      endDate: lease.endDate,
      rentAmount: lease.rentAmount,
      paymentCycle: lease.paymentCycle,
      securityDeposit: lease.isSecurityDeposit ? lease.securityDepositAmount : undefined,
      terms: lease.terms,
      generatedAt: new Date(),
    };
  }

  private async renderPdfFromTemplate(
    templateName: string,
    context: LeasePdfContext,
  ): Promise<Buffer> {
    const template = await this.getTemplate(templateName);
    const html = template(context);

    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  private async getTemplate(name: string): Promise<Handlebars.TemplateDelegate> {
    if (this.templateCache.has(name)) {
      return this.templateCache.get(name)!;
    }

    const templatePath = path.join(__dirname, '..', 'templates', `${name}.hbs`);

    if (!fs.existsSync(templatePath)) {
      throw new NotFoundException(`Template ${name} not found at ${templatePath}`);
    }

    const templateSource = fs.readFileSync(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSource);
    this.templateCache.set(name, template);

    return template;
  }
}
