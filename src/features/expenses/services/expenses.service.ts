import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Invoice, InvoiceDocument } from '../../maintenance/schemas/invoice.schema';
import { MediaService } from '../../media/services/media.service';
import { User } from '../../users/schemas/user.schema';
import { CreateExpenseDto } from '../dto/create-expense.dto';
import { ExpenseQueryDto } from '../dto/expense-query.dto';
import { UpdateExpenseDto } from '../dto/update-expense.dto';
import { Expense, ExpenseCategory, ExpenseDocument } from '../schemas/expense.schema';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectModel(Expense.name)
    private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    private mediaService: MediaService,
  ) {}

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
    data: any[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { page = 1, limit = 10, property, unit, category, status } = query;
    const skip = (page - 1) * limit;

    // Build filter for manual expenses
    const expenseFilter: any = {};
    if (property) expenseFilter.property = new Types.ObjectId(property);
    if (unit) expenseFilter.unit = new Types.ObjectId(unit);
    if (category) expenseFilter.category = category;
    if (status) expenseFilter.status = status;

    // Fetch manual expenses
    const [expenses, expensesCount] = await Promise.all([
      this.expenseModel
        .find(expenseFilter)
        .populate('property')
        .populate('unit')
        .populate('scopeOfWork')
        .populate('ticket')
        .populate('media')
        .sort({ date: -1 })
        .exec(),
      this.expenseModel.countDocuments(expenseFilter),
    ]);

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
        ticketData = await this.invoiceModel.db
          .collection('maintenancetickets')
          .findOne({ _id: invoice.linkedEntityId });

        if (ticketData) {
          // Get property from ticket
          propertyData = await this.invoiceModel.db
            .collection('properties')
            .findOne({ _id: ticketData.property });

          // Get unit from ticket if exists
          if (ticketData.unit) {
            unitData = await this.invoiceModel.db
              .collection('units')
              .findOne({ _id: ticketData.unit });
          }
        }
      } else if (invoice.linkedEntityModel === 'ScopeOfWork') {
        // Invoice is linked to a scope of work
        sowData = await this.invoiceModel.db
          .collection('scopeofworks')
          .findOne({ _id: invoice.linkedEntityId });

        if (sowData && sowData.ticket) {
          // Get ticket from scope of work
          ticketData = await this.invoiceModel.db
            .collection('maintenancetickets')
            .findOne({ _id: sowData.ticket });

          if (ticketData) {
            // Get property from ticket
            propertyData = await this.invoiceModel.db
              .collection('properties')
              .findOne({ _id: ticketData.property });

            // Get unit from ticket if exists
            if (ticketData.unit) {
              unitData = await this.invoiceModel.db
                .collection('units')
                .findOne({ _id: ticketData.unit });
            }
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

      // Enrich invoices media with URLs
      for (const invoice of invoices) {
        if ((invoice as any).media && (invoice as any).media.length > 0) {
          const enrichedMedia = await Promise.all(
            (invoice as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
          );
          (invoice as any).media = enrichedMedia;
        }
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
        media: (invoice as any).media,
        createdAt: (invoice as any).createdAt,
        updatedAt: (invoice as any).updatedAt,
        isInvoice: true,
        invoiceNumber: null,
      });
    }

    // Combine and sort all expenses
    const allExpenses = [...expenses.map((e) => e.toObject()), ...invoiceExpenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    // Apply pagination to combined results
    const paginatedExpenses = allExpenses.slice(skip, skip + limit);
    const totalCount = expensesCount + invoiceExpenses.length;

    return {
      data: paginatedExpenses,
      total: totalCount,
      page,
      limit,
    };
  }

  async findOne(id: string): Promise<ExpenseDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid expense ID');
    }

    const expense = await this.expenseModel
      .findById(id)
      .populate('property')
      .populate('unit')
      .populate('scopeOfWork')
      .populate('ticket')
      .populate('media')
      .exec();

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // Enrich media with URLs
    if ((expense as any).media && (expense as any).media.length > 0) {
      const enrichedMedia = await Promise.all(
        (expense as any).media.map((media: any) => this.mediaService.enrichMediaWithUrl(media)),
      );
      (expense as any).media = enrichedMedia;
    }

    return expense;
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

    // Upload new media if provided
    if (updateExpenseDto.media) {
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
}
