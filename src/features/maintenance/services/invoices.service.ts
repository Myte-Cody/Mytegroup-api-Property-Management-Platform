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
import { UserDocument } from '../../users/schemas/user.schema';
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
    private readonly mediaService: MediaService,
    private readonly sessionService: SessionService,
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

      const invoice = new this.invoiceModel({
        amount: createInvoiceDto.amount,
        currency: createInvoiceDto.currency,
        description: createInvoiceDto.description,
        issuer:
          currentUser.user_type === 'Contractor'
            ? InvoiceIssuer.CONTRACTOR
            : InvoiceIssuer.LANDLORD,
        linkedEntityType: InvoiceLinkedEntityType.TICKET,
        linkedEntityId: new Types.ObjectId(ticketId),
        linkedEntityModel: 'MaintenanceTicket',
        status: InvoiceStatus.PENDING,
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

      const invoice = new this.invoiceModel({
        amount: createInvoiceDto.amount,
        currency: createInvoiceDto.currency,
        description: createInvoiceDto.description,
        issuer:
          currentUser.user_type === 'Contractor'
            ? InvoiceIssuer.CONTRACTOR
            : InvoiceIssuer.LANDLORD,
        linkedEntityType: InvoiceLinkedEntityType.SCOPE_OF_WORK,
        linkedEntityId: new Types.ObjectId(sowId),
        linkedEntityModel: 'ScopeOfWork',
        status: InvoiceStatus.PENDING,
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

      // Update invoice fields
      invoice.amount = updateInvoiceDto.amount;
      invoice.currency = updateInvoiceDto.currency;

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
          status: InvoiceStatus.PENDING,
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
}
