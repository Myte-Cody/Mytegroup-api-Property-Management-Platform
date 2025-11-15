import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from '../../maintenance/schemas/invoice.schema';
import {
  MaintenanceTicket,
  MaintenanceTicketDocument,
} from '../../maintenance/schemas/maintenance-ticket.schema';
import { ScopeOfWork, ScopeOfWorkDocument } from '../../maintenance/schemas/scope-of-work.schema';
import { MediaService } from '../../media/services/media.service';
import { Property, PropertyDocument } from '../../properties/schemas/property.schema';
import { Unit, UnitDocument } from '../../properties/schemas/unit.schema';
import { User } from '../../users/schemas/user.schema';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { ExpenseQueryDto } from '../dto/expense-query.dto';
import { ExpenseResponseDto, ExpenseScope, ExpenseSource } from '../dto/expense-response.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import {
  Expense,
  ExpenseCategory,
  ExpenseDocument,
  ExpenseStatus,
} from '../schemas/expense.schema';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name)
    private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(MaintenanceTicket.name)
    private maintenanceTicketModel: Model<MaintenanceTicketDocument>,
    @InjectModel(ScopeOfWork.name)
    private scopeOfWorkModel: Model<ScopeOfWorkDocument>,
    @InjectModel(Property.name)
    private propertyModel: Model<PropertyDocument>,
    @InjectModel(Unit.name)
    private unitModel: Model<UnitDocument>,
    private mediaService: MediaService,
  ) {}

  /**
   * Format expense with computed source and scope fields
   */
  private formatExpenseResponse(expense: any, isInvoice = false): ExpenseResponseDto {
    const expenseObj = expense.toObject ? expense.toObject() : expense;

    // Determine source
    const source =
      isInvoice || expenseObj.isInvoice || expenseObj.scopeOfWork || expenseObj.ticket
        ? ExpenseSource.MAINTENANCE
        : ExpenseSource.MANUAL;

    // Determine scope
    const scope = expenseObj.unit ? ExpenseScope.UNIT : ExpenseScope.PROPERTY;

    return {
      ...expenseObj,
      source,
      scope,
      isInvoice: isInvoice || expenseObj.isInvoice || false,
    };
  }

  async create(createExpenseDto: CreateExpenseDto, currentUser: User): Promise<ExpenseDocument> {
    // Validate property ID
    if (!Types.ObjectId.isValid(createExpenseDto.property)) {
      throw new BadRequestException('Invalid property ID');
    }

    // Validate unit ID if provided
    if (createExpenseDto.unit && !Types.ObjectId.isValid(createExpenseDto.unit)) {
      throw new BadRequestException('Invalid unit ID');
    }

    const expense = new this.expenseModel({
      property: new Types.ObjectId(createExpenseDto.property),
      unit: createExpenseDto.unit ? new Types.ObjectId(createExpenseDto.unit) : undefined,
      category: createExpenseDto.category,
      amount: createExpenseDto.amount,
      description: createExpenseDto.description,
      status: createExpenseDto.status,
    });

    const savedExpense = await expense.save();

    // Upload media if provided
    if (createExpenseDto.media) {
      try {
        await this.mediaService.upload(
          createExpenseDto.media,
          savedExpense,
          currentUser,
          'expenses',
          undefined,
          'Expense',
        );
      } catch (error) {
        // If upload fails, delete the expense and re-throw
        await this.expenseModel.findByIdAndDelete(savedExpense._id);
        throw error;
      }
    }

    // Populate media with URLs before returning
    const expenseWithMedia = await this.expenseModel
      .findById(savedExpense._id)
      .populate('media')
      .exec();

    // Enrich media with URLs
    if (
      expenseWithMedia &&
      (expenseWithMedia as any).media &&
      (expenseWithMedia as any).media.length > 0
    ) {
      const enrichedMedia = await Promise.all(
        (expenseWithMedia as any).media.map((media: any) =>
          this.mediaService.enrichMediaWithUrl(media),
        ),
      );
      (expenseWithMedia as any).media = enrichedMedia;
    }

    return expenseWithMedia || savedExpense;
  }

  async findAll(query: ExpenseQueryDto): Promise<{
    data: ExpenseResponseDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      page = 1,
      limit = 10,
      property,
      unit,
      category,
      status,
      scopeOfWork,
      ticket,
      source,
      scope,
      startDate,
      endDate,
      search,
    } = query;
    const skip = (page - 1) * limit;

    // Build filter for manual expenses
    const expenseFilter: any = {};
    if (property) expenseFilter.property = new Types.ObjectId(property);
    if (unit) expenseFilter.unit = new Types.ObjectId(unit);
    if (category) expenseFilter.category = category;
    if (status) expenseFilter.status = status;
    if (scopeOfWork) expenseFilter.scopeOfWork = new Types.ObjectId(scopeOfWork);
    if (ticket) expenseFilter.ticket = new Types.ObjectId(ticket);

    // Date range filter
    if (startDate || endDate) {
      expenseFilter.date = {};
      if (startDate) expenseFilter.date.$gte = new Date(startDate);
      if (endDate) expenseFilter.date.$lte = new Date(endDate);
    }

    // Search filter
    if (search) {
      expenseFilter.description = { $regex: search, $options: 'i' };
    }

    // Fetch manual expenses
    const expenses = await this.expenseModel
      .find(expenseFilter)
      .populate('property')
      .populate('unit')
      .populate('scopeOfWork')
      .populate('ticket')
      .populate('media')
      .sort({ date: -1 })
      .exec();

    // Enrich expenses media with URLs
    for (const expense of expenses) {
      if ((expense as any).media && (expense as any).media.length > 0) {
        const enrichedMedia = await Promise.all(
          (expense as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
        );
        (expense as any).media = enrichedMedia;
      }
    }

    // Build filter for invoice expenses
    const invoiceFilter: any = {};
    if (status) invoiceFilter.status = status;

    // Fetch maintenance invoices without populate - we'll manually resolve references
    const invoices = await this.invoiceModel
      .find(invoiceFilter)
      .populate('media')
      .sort({ createdAt: -1 })
      .exec();

    // Convert invoices to expense format by manually resolving references
    const invoiceExpenses: any[] = [];

    for (const invoice of invoices) {
      let ticketData: any = null;
      let sowData: any = null;
      let propertyData: any = null;
      let unitData: any = null;

      // Check the linkedEntityModel and fetch the appropriate entity
      if (invoice.linkedEntityModel === 'MaintenanceTicket') {
        // Invoice is linked to a ticket directly
        ticketData = await this.maintenanceTicketModel
          .findById(invoice.linkedEntityId)
          .lean()
          .exec();

        if (ticketData) {
          // Get property from ticket
          propertyData = await this.propertyModel.findById(ticketData.property).lean().exec();

          // Get unit from ticket if exists
          if (ticketData.unit) {
            unitData = await this.unitModel.findById(ticketData.unit).lean().exec();
          }
        }
      } else if (invoice.linkedEntityModel === 'ScopeOfWork') {
        // Invoice is linked to a scope of work
        sowData = await this.scopeOfWorkModel.findById(invoice.linkedEntityId).lean().exec();
        if (sowData) {
          // Get property and unit directly from SOW
          if (sowData.property) {
            propertyData = await this.propertyModel.findById(sowData.property).lean().exec();
          }

          if (sowData.unit) {
            unitData = await this.unitModel.findById(sowData.unit).lean().exec();
          }
        }
      }

      // Apply filters
      if (property && (!propertyData || propertyData._id.toString() !== property)) {
        continue;
      }
      if (unit && (!unitData || unitData._id.toString() !== unit)) {
        continue;
      }
      if (category && category !== ExpenseCategory.MAINTENANCE_REPAIRS) {
        continue;
      }

      // Enrich invoice media with URLs
      let enrichedMedia: any[] = [];
      if ((invoice as any).media && (invoice as any).media.length > 0) {
        enrichedMedia = await Promise.all(
          (invoice as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
        );
      }

      // Build the expense object
      invoiceExpenses.push({
        _id: invoice._id,
        property: propertyData || null,
        unit: unitData || null,
        scopeOfWork: sowData?._id || null,
        ticket: ticketData?._id || null,
        category: ExpenseCategory.MAINTENANCE_REPAIRS,
        amount: invoice.amount,
        description: `Invoice - ${invoice.description || sowData?.title || ticketData?.title || 'Maintenance'}`,
        date: (invoice as any).createdAt,
        status: invoice.status,
        media: enrichedMedia,
        createdAt: (invoice as any).createdAt,
        updatedAt: (invoice as any).updatedAt,
        isInvoice: true,
        invoiceNumber: null,
      });
    }

    // Format expenses with computed fields
    const formattedExpenses = expenses.map((e) => this.formatExpenseResponse(e, false));
    const formattedInvoices = invoiceExpenses.map((e) => this.formatExpenseResponse(e, true));

    // Combine all expenses
    let allExpenses = [...formattedExpenses, ...formattedInvoices];

    // Apply source filter
    if (source) {
      allExpenses = allExpenses.filter((e) => e.source === source);
    }

    // Apply scope filter
    if (scope) {
      allExpenses = allExpenses.filter((e) => e.scope === scope);
    }

    // Sort by date (most recent first)
    allExpenses.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Apply pagination to combined results
    const totalCount = allExpenses.length;
    const paginatedExpenses = allExpenses.slice(skip, skip + limit);
    const totalPages = Math.ceil(totalCount / limit);

    return {
      data: paginatedExpenses,
      total: totalCount,
      page,
      limit,
      totalPages,
    };
  }

  async findOne(id: string): Promise<ExpenseResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid expense ID');
    }

    // Try to find in expenses collection first
    const expense = await this.expenseModel
      .findById(id)
      .populate('property')
      .populate('unit')
      .populate('scopeOfWork')
      .populate('ticket')
      .populate('media')
      .exec();

    if (expense) {
      // Enrich media with URLs
      if ((expense as any).media && (expense as any).media.length > 0) {
        const enrichedMedia = await Promise.all(
          (expense as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
        );
        (expense as any).media = enrichedMedia;
      }

      return this.formatExpenseResponse(expense);
    }

    // If not found in expenses, check if it's an invoice
    const invoice = await this.invoiceModel.findById(id).populate('media').exec();

    if (!invoice) {
      throw new NotFoundException('Expense not found');
    }

    // Build expense object from invoice
    let ticketData: any = null;
    let sowData: any = null;
    let propertyData: any = null;
    let unitData: any = null;

    // Check the linkedEntityModel and fetch the appropriate entity
    if (invoice.linkedEntityModel === 'MaintenanceTicket') {
      // Invoice is linked to a ticket directly
      ticketData = await this.maintenanceTicketModel.findById(invoice.linkedEntityId).lean().exec();

      if (ticketData) {
        // Get property from ticket
        propertyData = await this.propertyModel.findById(ticketData.property).lean().exec();

        // Get unit from ticket if exists
        if (ticketData.unit) {
          unitData = await this.unitModel.findById(ticketData.unit).lean().exec();
        }
      }
    } else if (invoice.linkedEntityModel === 'ScopeOfWork') {
      // Invoice is linked to a scope of work
      sowData = await this.scopeOfWorkModel.findById(invoice.linkedEntityId).lean().exec();

      if (sowData) {
        // Get property and unit directly from SOW
        if (sowData.property) {
          propertyData = await this.propertyModel.findById(sowData.property).lean().exec();
        }

        if (sowData.unit) {
          unitData = await this.unitModel.findById(sowData.unit).lean().exec();
        }
      }
    }

    // Enrich invoice media with URLs
    if ((invoice as any).media && (invoice as any).media.length > 0) {
      const enrichedMedia = await Promise.all(
        (invoice as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
      );
      (invoice as any).media = enrichedMedia;
    }

    // Build the expense object from invoice
    const invoiceExpense = {
      _id: invoice._id,
      property: propertyData || null,
      unit: unitData || null,
      scopeOfWork: sowData?._id || null,
      ticket: ticketData?._id || null,
      category: ExpenseCategory.MAINTENANCE_REPAIRS,
      amount: invoice.amount,
      description: `Invoice - ${invoice.description || sowData?.title || ticketData?.title || 'Maintenance'}`,
      date: (invoice as any).createdAt,
      status: invoice.status,
      media: (invoice as any).media,
      createdAt: (invoice as any).createdAt,
      updatedAt: (invoice as any).updatedAt,
      isInvoice: true,
      invoiceNumber: null,
    };

    return this.formatExpenseResponse(invoiceExpense, true);
  }

  async update(
    id: string,
    updateExpenseDto: UpdateExpenseDto,
    currentUser: User,
  ): Promise<ExpenseDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid expense ID');
    }

    const expense = await this.expenseModel.findById(id);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Validate IDs if they are being updated
    if (updateExpenseDto.property && !Types.ObjectId.isValid(updateExpenseDto.property)) {
      throw new BadRequestException('Invalid property ID');
    }
    if (updateExpenseDto.unit && !Types.ObjectId.isValid(updateExpenseDto.unit)) {
      throw new BadRequestException('Invalid unit ID');
    }

    // Update fields
    if (updateExpenseDto.property) expense.property = new Types.ObjectId(updateExpenseDto.property);
    if (updateExpenseDto.unit) expense.unit = new Types.ObjectId(updateExpenseDto.unit);
    if (updateExpenseDto.category) expense.category = updateExpenseDto.category;
    if (updateExpenseDto.amount !== undefined) expense.amount = updateExpenseDto.amount;

    if (updateExpenseDto.description !== undefined)
      expense.description = updateExpenseDto.description;
    if (updateExpenseDto.status) expense.status = updateExpenseDto.status;

    const updatedExpense = await expense.save();

    // Replace media if provided
    if (updateExpenseDto.media) {
      // Delete existing media
      const existingMedia = await this.mediaService.getMediaForEntity(
        'Expense',
        String(updatedExpense._id),
        currentUser,
        'expenses',
      );

      for (const media of existingMedia) {
        await this.mediaService.deleteMedia(String(media._id), currentUser);
      }

      // Upload new media
      await this.mediaService.upload(
        updateExpenseDto.media,
        updatedExpense,
        currentUser,
        'expenses',
        undefined,
        'Expense',
      );
    }

    // Return updated expense with media
    const expenseWithMedia = await this.expenseModel
      .findById(updatedExpense._id)
      .populate('property')
      .populate('unit')
      .populate('scopeOfWork')
      .populate('ticket')
      .populate('media')
      .exec();

    // Enrich media with URLs
    if (
      expenseWithMedia &&
      (expenseWithMedia as any).media &&
      (expenseWithMedia as any).media.length > 0
    ) {
      const enrichedMedia = await Promise.all(
        (expenseWithMedia as any).media.map((media: any) =>
          this.mediaService.enrichMediaWithUrl(media),
        ),
      );
      (expenseWithMedia as any).media = enrichedMedia;
    }

    return expenseWithMedia || updatedExpense;
  }

  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid expense ID');
    }

    const expense = await this.expenseModel.findById(id);
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    await this.expenseModel.findByIdAndDelete(id);
  }

  async confirm(id: string): Promise<ExpenseResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid expense ID');
    }

    const expense = await this.expenseModel.findById(id).exec();

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Check if expense is already confirmed
    if (expense.status === ExpenseStatus.CONFIRMED) {
      throw new BadRequestException('Expense is already confirmed');
    }

    // Update status to confirmed
    expense.status = ExpenseStatus.CONFIRMED;
    await expense.save();

    // Return the updated expense with all populated fields
    const updatedExpense = await this.expenseModel
      .findById(id)
      .populate('property')
      .populate('unit')
      .populate('scopeOfWork')
      .populate('ticket')
      .populate('media')
      .exec();

    // Enrich media with URLs
    if ((updatedExpense as any).media && (updatedExpense as any).media.length > 0) {
      const enrichedMedia = await Promise.all(
        (updatedExpense as any).media.map((media: any) =>
          this.mediaService.enrichMediaWithUrl(media),
        ),
      );
      (updatedExpense as any).media = enrichedMedia;
    }

    return this.formatExpenseResponse(updatedExpense);
  }
}
