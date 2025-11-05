import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Types } from 'mongoose';
import {
  InvoiceIssuer,
  InvoiceLinkedEntityType,
  InvoiceStatus,
} from '../../../common/enums/maintenance.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { SessionService } from '../../../common/services/session.service';
import {
  AiExtractionService,
  InvoiceExtractionResult,
} from '../../ai/services/ai-extraction.service';
import { Contractor } from '../../contractors/schema/contractor.schema';
import { MaintenanceEmailService } from '../../email/services/maintenance-email.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { CreateInvoiceDto, UpdateInvoiceDto } from '../dto';
import { Invoice } from '../schemas/invoice.schema';
import { MaintenanceTicket } from '../schemas/maintenance-ticket.schema';
import { ScopeOfWork } from '../schemas/scope-of-work.schema';
import { MediaService } from './../../media/services/media.service';

@Injectable()
export class InvoicesService {
  constructor(
    @InjectModel(Invoice.name)
    private readonly invoiceModel: AppModel<Invoice>,
    @InjectModel(MaintenanceTicket.name)
    private readonly ticketModel: AppModel<MaintenanceTicket>,
    @InjectModel(ScopeOfWork.name)
    private readonly scopeOfWorkModel: AppModel<ScopeOfWork>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    @InjectModel(Contractor.name)
    private readonly contractorModel: AppModel<Contractor>,
    private readonly mediaService: MediaService,
    private readonly sessionService: SessionService,
    private readonly aiExtractionService: AiExtractionService,
    private readonly notificationsService: NotificationsService,
    private readonly maintenanceEmailService: MaintenanceEmailService,
  ) {}

  async createInvoiceForTicket(
    ticketId: string,
    createInvoiceDto: CreateInvoiceDto,
    currentUser: UserDocument,
  ) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const ticket = await this.ticketModel.findById(ticketId).session(session).exec();

      if (!ticket) {
        throw new NotFoundException('Ticket not found');
      }

      // Extract data from invoice file if provided
      let extractedData: InvoiceExtractionResult = null;
      if (createInvoiceDto.invoice_file) {
        extractedData = await this.aiExtractionService.extractInvoiceData(
          createInvoiceDto.invoice_file,
        );
      }

      // Use extracted data if available, otherwise use provided values
      const amount = extractedData?.total_amount || createInvoiceDto.amount;
      const currency = extractedData?.currency || createInvoiceDto.currency;

      const invoice = new this.invoiceModel({
        amount: amount,
        currency: currency,
        description: createInvoiceDto.description,
        notes: createInvoiceDto.notes,
        issuer:
          currentUser.user_type === 'Contractor'
            ? InvoiceIssuer.CONTRACTOR
            : InvoiceIssuer.LANDLORD,
        linkedEntityType: InvoiceLinkedEntityType.TICKET,
        linkedEntityId: new Types.ObjectId(ticketId),
        linkedEntityModel: 'MaintenanceTicket',
        status: InvoiceStatus.DRAFT,
        createdBy: currentUser._id,
      });

      await invoice.save({ session });

      // Handle invoice file (only one file allowed)
      if (createInvoiceDto.invoice_file) {
        await this.mediaService.upload(
          createInvoiceDto.invoice_file,
          invoice,
          currentUser,
          'invoice_files',
          undefined,
          'Invoice',
          session,
        );
      }

      // Send notification to landlord if invoice was uploaded by contractor
      if (currentUser.user_type === 'Contractor') {
        await this.notifyLandlordOfInvoiceUpload(ticket, null, invoice, currentUser, session);
      }

      return this.findById(String(invoice._id), currentUser, session);
    });
  }

  async createInvoiceForScopeOfWork(
    sowId: string,
    createInvoiceDto: CreateInvoiceDto,
    currentUser: UserDocument,
  ) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const sow = await this.scopeOfWorkModel.findById(sowId).session(session).exec();

      if (!sow) {
        throw new NotFoundException('Scope of Work not found');
      }

      // Extract data from invoice file if provided
      let extractedData: InvoiceExtractionResult = null;
      if (createInvoiceDto.invoice_file) {
        extractedData = await this.aiExtractionService.extractInvoiceData(
          createInvoiceDto.invoice_file,
        );
      }

      // Use extracted data if available, otherwise use provided values
      const amount = extractedData?.total_amount || createInvoiceDto.amount;
      const currency = extractedData?.currency || createInvoiceDto.currency;

      const invoice = new this.invoiceModel({
        amount: amount,
        currency: currency,
        description: createInvoiceDto.description,
        notes: createInvoiceDto.notes,
        issuer:
          currentUser.user_type === 'Contractor'
            ? InvoiceIssuer.CONTRACTOR
            : InvoiceIssuer.LANDLORD,
        linkedEntityType: InvoiceLinkedEntityType.SCOPE_OF_WORK,
        linkedEntityId: new Types.ObjectId(sowId),
        linkedEntityModel: 'ScopeOfWork',
        status: InvoiceStatus.DRAFT,
        createdBy: currentUser._id,
      });

      await invoice.save({ session });

      // Handle invoice file (only one file allowed)
      if (createInvoiceDto.invoice_file) {
        await this.mediaService.upload(
          createInvoiceDto.invoice_file,
          invoice,
          currentUser,
          'invoice_files',
          undefined,
          'Invoice',
          session,
        );
      }

      // Send notification to landlord if invoice was uploaded by contractor
      if (currentUser.user_type === 'Contractor') {
        await this.notifyLandlordOfInvoiceUpload(null, sow, invoice, currentUser, session);
      }

      return this.findById(String(invoice._id), currentUser, session);
    });
  }

  async getInvoicesByTicket(ticketId: string) {
    const ticket = await this.ticketModel.findById(ticketId).exec();

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    const invoices = await this.invoiceModel
      .find({
        linkedEntityId: new Types.ObjectId(ticketId),
        linkedEntityType: InvoiceLinkedEntityType.TICKET,
      })
      .populate('createdBy', 'first_name last_name email')
      .sort({ createdAt: -1 })
      .exec();

    // Manually fetch invoice files using media service
    const invoicesWithFiles = await Promise.all(
      invoices.map(async (invoice) => {
        const files = await this.mediaService.getMediaForEntity(
          'Invoice',
          String(invoice._id),
          invoice.createdBy as any,
          'invoice_files',
        );
        return {
          ...invoice.toObject(),
          invoiceFile: files.length > 0 ? files[0] : null,
        };
      }),
    );

    return invoicesWithFiles;
  }

  async getInvoicesByScopeOfWork(sowId: string) {
    const sow = await this.scopeOfWorkModel.findById(sowId).exec();

    if (!sow) {
      throw new NotFoundException('Scope of Work not found');
    }

    const invoices = await this.invoiceModel
      .find({
        linkedEntityId: new Types.ObjectId(sowId),
        linkedEntityType: InvoiceLinkedEntityType.SCOPE_OF_WORK,
      })
      .populate('createdBy', 'first_name last_name email')
      .sort({ createdAt: -1 })
      .exec();

    // Manually fetch invoice files using media service
    const invoicesWithFiles = await Promise.all(
      invoices.map(async (invoice) => {
        const files = await this.mediaService.getMediaForEntity(
          'Invoice',
          String(invoice._id),
          invoice.createdBy as any,
          'invoice_files',
        );
        return {
          ...invoice.toObject(),
          invoiceFile: files.length > 0 ? files[0] : null,
        };
      }),
    );

    return invoicesWithFiles;
  }

  async updateInvoice(
    invoiceId: string,
    updateInvoiceDto: UpdateInvoiceDto,
    currentUser: UserDocument,
  ) {
    return await this.sessionService.withSession(async (session: ClientSession) => {
      const invoice = await this.invoiceModel.findById(invoiceId).session(session).exec();

      if (!invoice) {
        throw new NotFoundException('Invoice not found');
      }

      // Extract data from invoice file if provided
      let extractedData: InvoiceExtractionResult = null;
      if (updateInvoiceDto.invoice_file) {
        extractedData = await this.aiExtractionService.extractInvoiceData(
          updateInvoiceDto.invoice_file,
        );
      }

      // Update invoice fields - use extracted data if available
      invoice.amount = extractedData?.total_amount || updateInvoiceDto.amount;
      invoice.currency = extractedData?.currency || updateInvoiceDto.currency;

      if (updateInvoiceDto.description !== undefined) {
        invoice.description = updateInvoiceDto.description;
      }

      await invoice.save({ session });

      // Handle invoice file - replace existing file if a new one is provided
      if (updateInvoiceDto.invoice_file) {
        // Delete existing file
        const existingFiles = await this.mediaService.getMediaForEntity(
          'Invoice',
          String(invoice._id),
          currentUser,
          'invoice_files',
        );

        for (const file of existingFiles) {
          await this.mediaService.deleteMedia(String(file._id), currentUser, session);
        }

        // Add new file
        await this.mediaService.upload(
          updateInvoiceDto.invoice_file,
          invoice,
          currentUser,
          'invoice_files',
          undefined,
          'Invoice',
          session,
        );
      }
      return this.findById(String(invoice._id), currentUser, session);
    });
  }

  async deleteInvoice(invoiceId: string, currentUser: UserDocument, session?: ClientSession) {
    const invoice = await this.invoiceModel.findById(invoiceId).session(session).exec();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Delete associated media files
    const existingFiles = await this.mediaService.getMediaForEntity(
      'Invoice',
      String(invoice._id),
      currentUser,
      'invoice_files',
    );

    for (const file of existingFiles) {
      await this.mediaService.deleteMedia(String(file._id), currentUser);
    }

    // Soft delete the invoice
    await (invoice as any).delete({ session });

    return { message: 'Invoice deleted successfully' };
  }

  async confirmInvoicesByLinkedEntity(
    linkedEntityId: Types.ObjectId,
    linkedEntityType: InvoiceLinkedEntityType,
    session?: ClientSession,
  ) {
    await this.invoiceModel
      .updateMany(
        {
          linkedEntityId,
          linkedEntityType,
          status: InvoiceStatus.DRAFT,
        },
        {
          $set: { status: InvoiceStatus.CONFIRMED },
        },
        { session },
      )
      .exec();
  }

  async findById(
    invoiceId: string,
    currentUser: UserDocument,
    session: ClientSession | null = null,
  ) {
    const invoice = await this.invoiceModel
      .findById(invoiceId, null, { session })
      .populate('createdBy', 'first_name last_name email')
      .exec();

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Manually fetch invoice file using media service
    const files = await this.mediaService.getMediaForEntity(
      'Invoice',
      String(invoice._id),
      currentUser,
      'invoice_files',
    );

    return {
      ...invoice.toObject(),
      invoiceFile: files.length > 0 ? files[0] : null,
    };
  }

  /**
   * Notify landlord when an invoice is uploaded by contractor
   */
  private async notifyLandlordOfInvoiceUpload(
    ticket: MaintenanceTicket | null,
    sow: ScopeOfWork | null,
    invoice: Invoice,
    currentUser: UserDocument,
    session: ClientSession | null,
  ): Promise<void> {
    try {
      // Find the landlord user
      const landlordUser = await this.userModel
        .findOne({ user_type: 'Landlord' }, null, { session })
        .exec();

      if (!landlordUser) {
        return;
      }

      // Get contractor information
      const contractor = await this.contractorModel
        .findById(currentUser.organization_id, null, { session })
        .exec();

      const contractorName = contractor?.name || 'Contractor';

      // Determine the entity reference (ticket or SOW code)
      let entityReference = '';
      if (ticket) {
        entityReference = ticket.ticketNumber || ticket.title;
      } else if (sow) {
        entityReference = (sow as any).code || 'Scope of Work';
      }

      // Send in-app notification
      await this.notificationsService.createNotification(
        landlordUser._id.toString(),
        'Invoice Uploaded',
        `Contractor ${contractorName} uploaded invoice for ${entityReference}.`,
      );

      const landlordName =
        landlordUser.firstName && landlordUser.lastName
          ? `${landlordUser.firstName} ${landlordUser.lastName}`
          : landlordUser.username;

      // Send email notification
      await this.maintenanceEmailService.sendInvoiceUploadedEmail(
        {
          recipientName: landlordName,
          recipientEmail: landlordUser.email,
          contractorName,
          entityReference,
          invoiceNumber: invoice.invoiceNumber,
          amount: invoice.amount,
          uploadedAt: invoice.createdAt || new Date(),
        },
        { queue: true },
      );
    } catch (error) {
      console.error('Failed to notify landlord of invoice upload:', error);
    }
  }
}
