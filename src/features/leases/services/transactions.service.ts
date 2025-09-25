import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { addDaysToDate, createDateRangeFilter } from '../../../common/utils/date.utils';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../../common/utils/pagination.utils';
import { PaymentEmailService } from '../../email/services/payment-email.service';
import { MediaService } from '../../media/services/media.service';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { UploadTransactionProofDto } from '../dto';
import { MarkTransactionAsPaidDto } from '../dto/mark-transaction-as-paid.dto';
import { Lease } from '../schemas/lease.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { Transaction } from '../schemas/transaction.schema';
import { getFirstTransactionDueDate } from '../utils/transaction-schedule.utils';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: AppModel<Transaction>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    @InjectModel(User.name)
    private readonly userModel: AppModel<User>,
    private readonly mediaService: MediaService,
    private readonly paymentEmailService: PaymentEmailService,
  ) {}

  async findAllPaginated(queryDto: any, currentUser: UserDocument): Promise<any> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
      leaseId,
      rentalPeriodId,
      paymentMethod,
      startDate,
      endDate,
    } = queryDto;

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      return createEmptyPaginatedResponse(page, limit);
    }

    let baseQuery = this.transactionModel.byTenant(landlordId).find();

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (type) {
      baseQuery = baseQuery.where({ type });
    }

    if (leaseId) {
      baseQuery = baseQuery.where({ lease: leaseId });
    }

    if (rentalPeriodId) {
      baseQuery = baseQuery.where({ rentalPeriod: rentalPeriodId });
    }

    if (paymentMethod) {
      baseQuery = baseQuery.where({ paymentMethod });
    }

    if (startDate || endDate) {
      const dateFilter = createDateRangeFilter(startDate, endDate);
      baseQuery = baseQuery.where({ paidAt: dateFilter });
    }

    const sortObj: any = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [transactions, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'lease',
          select: 'unit tenant',
          populate: [
            {
              path: 'unit',
              select: 'unitNumber type',
              populate: { path: 'property', select: 'name address' },
            },
            { path: 'tenant', select: 'name' },
          ],
        })
        .populate('rentalPeriod', 'startDate endDate rentAmount')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse(transactions, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const transaction = await this.transactionModel
      .byTenant(landlordId)
      .findById(id)
      .populate({
        path: 'lease',
        select: 'unit tenant terms tenantId',
        populate: [
          {
            path: 'unit',
            select: 'unitNumber type',
            populate: { path: 'property', select: 'name address' },
          },
          { path: 'tenant', select: 'name' },
        ],
      })
      .populate('rentalPeriod', 'startDate endDate rentAmount')
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async create(createTransactionDto: any, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Cannot create transaction: No tenant context');
    }

    await this.validateTransactionCreation(createTransactionDto, landlordId);

    const TransactionWithTenant = this.transactionModel.byTenant(landlordId);

    // For manual transaction creation, create single transaction with provided or calculated due date
    let transactionData = { ...createTransactionDto };

    if (!createTransactionDto.dueDate && createTransactionDto.rentalPeriod) {
      const rentalPeriod = await this.rentalPeriodModel
        .byTenant(landlordId)
        .findById(createTransactionDto.rentalPeriod)
        .populate('lease')
        .exec();

      if (rentalPeriod && typeof rentalPeriod.lease === 'object') {
        const lease = rentalPeriod.lease as any;
        // For manual transaction creation, use the first transaction due date from the schedule
        transactionData.dueDate = getFirstTransactionDueDate(
          rentalPeriod.startDate,
          rentalPeriod.endDate,
          lease.paymentCycle,
        );
      }
    }

    const newTransaction = new TransactionWithTenant(transactionData);
    return await newTransaction.save();
  }

  async update(id: string, updateTransactionDto: any, currentUser: UserDocument) {
    if (!updateTransactionDto || Object.keys(updateTransactionDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Find existing transaction
    const existingTransaction = await this.transactionModel
      .byTenant(landlordId)
      .findById(id)
      .exec();

    if (!existingTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (existingTransaction.status === PaymentStatus.PROCESSED) {
      throw new BadRequestException('Cannot modify processed transactions');
    }

    // Update the transaction
    Object.assign(existingTransaction, updateTransactionDto);
    return await existingTransaction.save();
  }

  async processTransaction(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const transaction = await this.transactionModel.byTenant(landlordId).findById(id).exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending transactions can be processed');
    }

    transaction.status = PaymentStatus.PROCESSED;

    // TODO: After transaction is processed and marked as PAID, calculate and update
    // the nextTransactionDueDate in the associated lease based on payment cycle

    return await transaction.save();
  }

  async remove(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Find transaction
    const transaction = await this.transactionModel.byTenant(landlordId).findById(id).exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Only allow deletion of PENDING transactions
    if (transaction.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending transactions can be deleted');
    }

    await this.transactionModel.deleteById(id);
    return { message: 'Transaction deleted successfully' };
  }

  // Analytics and Reporting Methods

  async getTransactionsByLease(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const transactions = await this.transactionModel
      .byTenant(landlordId)
      .find({ lease: leaseId })
      .sort({ dueDate: 1 })
      .populate('rentalPeriod', 'startDate endDate rentAmount')
      .exec();

    return transactions;
  }

  async getTransactionSummary(leaseId: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    // Verify lease exists
    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();
    if (!lease) {
      throw new NotFoundException(`Lease with ID ${leaseId} not found`);
    }

    const transactions = await this.transactionModel
      .byTenant(landlordId)
      .find({ lease: leaseId })
      .exec();

    const summary = {
      totalTransactions: transactions.length,
      totalAmount: transactions.reduce((sum, p) => sum + p.amount, 0),
      processedAmount: transactions
        .filter((p) => p.status === PaymentStatus.PROCESSED)
        .reduce((sum, p) => sum + p.amount, 0),
      pendingAmount: transactions
        .filter((p) => p.status === PaymentStatus.PENDING)
        .reduce((sum, p) => sum + p.amount, 0),
      byType: {
        rent: transactions.filter((p) => p.type === PaymentType.RENT).length,
        deposit: transactions.filter((p) => p.type === PaymentType.DEPOSIT).length,
        fees: transactions.filter((p) => p.type === PaymentType.FEES).length,
        utilities: transactions.filter((p) => p.type === PaymentType.UTILITIES).length,
        maintenance: transactions.filter((p) => p.type === PaymentType.MAINTENANCE).length,
        other: transactions.filter((p) => p.type === PaymentType.OTHER).length,
      },
      byStatus: {
        pending: transactions.filter((p) => p.status === PaymentStatus.PENDING).length,
        processed: transactions.filter((p) => p.status === PaymentStatus.PROCESSED).length,
        failed: transactions.filter((p) => p.status === PaymentStatus.FAILED).length,
      },
    };

    return summary;
  }

  // Helper Methods

  private async validateTransactionCreation(createTransactionDto: any, landlordId: any) {
    // Validate lease exists
    const lease = await this.leaseModel
      .byTenant(landlordId)
      .findById(createTransactionDto.lease)
      .exec();
    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (createTransactionDto.rentalPeriod) {
      const rentalPeriod = await this.rentalPeriodModel
        .byTenant(landlordId)
        .findById(createTransactionDto.rentalPeriod)
        .exec();
      if (!rentalPeriod) {
        throw new NotFoundException('RentalPeriod not found');
      }

      if (rentalPeriod.lease.toString() !== createTransactionDto.lease) {
        throw new BadRequestException('RentalPeriod does not belong to the specified lease');
      }
    }

    // Validate amount
    if (!createTransactionDto.amount || createTransactionDto.amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than 0');
    }

    // Validate transaction date
    if (createTransactionDto.paidAt && new Date(createTransactionDto.paidAt) > new Date()) {
      throw new BadRequestException('Transaction date cannot be in the future');
    }
  }

  async submitTransactionProof(
    leaseId: string,
    rentalPeriodId: string,
    submitDto: UploadTransactionProofDto,
    currentUser: UserDocument,
  ): Promise<Transaction> {
    const landlordId = this.getLandlordId(currentUser);

    const transaction = await this.transactionModel
      .byTenant(landlordId)
      .findOne({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
      })
      .populate('lease rentalPeriod')
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found for this rental period');
    }

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(
        'Transaction proof can only be submitted for pending transactions',
      );
    }

    if (new Date(submitDto.paidAt) > new Date()) {
      throw new BadRequestException('Transaction date cannot be in the future');
    }

    const updatedTransaction = await this.transactionModel
      .byTenant(landlordId)
      .findByIdAndUpdate(
        transaction._id,
        {
          paymentMethod: submitDto.paymentMethod,
          paidAt: submitDto.paidAt,
          status: PaymentStatus.PAID,
        },
        { new: true },
      )
      .populate('lease rentalPeriod')
      .exec();

    if (submitDto.media_files && submitDto.media_files.length > 0) {
      const uploadPromises = submitDto.media_files.map(async (file) => {
        return this.mediaService.upload(file, updatedTransaction, currentUser, 'transaction_proof');
      });

      await Promise.all(uploadPromises);
    }

    return updatedTransaction;
  }

  async getTransactionForRentalPeriod(
    leaseId: string,
    rentalPeriodId: string,
    currentUser: UserDocument,
  ): Promise<Transaction> {
    const landlordId = this.getLandlordId(currentUser);

    const transaction = await this.transactionModel
      .byTenant(landlordId)
      .findOne({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
      })
      .populate('lease rentalPeriod')
      .exec();

    if (!transaction) {
      throw new NotFoundException('Transaction not found for this rental period');
    }

    return transaction;
  }

  async markAsPaid(id: string, markAsPaidDto: MarkTransactionAsPaidDto, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const transaction = await this.transactionModel
      .byTenant(landlordId)
      .findById(id)
      .populate('lease rentalPeriod')
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Update transaction status to PAID
    transaction.status = PaymentStatus.PAID;
    transaction.paidAt = new Date();

    if (markAsPaidDto.paymentMethod) {
      transaction.paymentMethod = markAsPaidDto.paymentMethod;
    }

    if (markAsPaidDto.notes) {
      transaction.notes = markAsPaidDto.notes;
    }

    await transaction.save();

    // Send payment confirmation email
    await this.sendPaymentConfirmation(transaction._id.toString());

    return transaction;
  }

  async markAsNotPaid(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const transaction = await this.transactionModel
      .byTenant(landlordId)
      .findById(id)
      .populate('lease rentalPeriod')
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    // Reset transaction to default pending state
    transaction.status = PaymentStatus.PENDING;
    transaction.paidAt = undefined;
    transaction.paymentMethod = undefined;
    transaction.notes = undefined;

    await transaction.save();

    return transaction;
  }

  private getLandlordId(currentUser: UserDocument) {
    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : currentUser.tenantId;
  }

  /**
   * Send payment reminder emails for transactions due in 7 days
   * @param baseDate Optional reference date (defaults to today)
   */
  async sendPaymentDueReminders(baseDate?: Date): Promise<void> {
    try {
      // Use provided baseDate or default to today
      const referenceDate = baseDate ? new Date(baseDate) : new Date();

      // Calculate the target due date (7 days from reference date)
      const targetDueDate = addDaysToDate(referenceDate, 7);

      // Set start and end of the target day
      const startOfDay = new Date(targetDueDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDueDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find all pending transactions due on the target date
      const transactions = await this.transactionModel
        .find({
          status: PaymentStatus.PENDING,
          dueDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .populate({
          path: 'lease',
          select: 'unit tenant',
          populate: [
            {
              path: 'unit',
              select: 'unitNumber type',
              populate: { path: 'property', select: 'name address' },
            },
            { path: 'tenant', select: 'name email' },
          ],
        })
        .populate('rentalPeriod', 'startDate endDate rentAmount')
        .exec();

      if (transactions.length === 0) {
        console.log(
          `No payment reminders to send for due date ${targetDueDate.toISOString().split('T')[0]}`,
        );
        return;
      }

      // Process each transaction and send reminder
      const reminderData = [];

      for (const transaction of transactions) {
        const lease = transaction.lease as any;
        const tenant = lease.tenant as any;
        const unit = lease.unit as any;
        const property = unit.property as any;
        const rentalPeriod = transaction.rentalPeriod as any;

        // Find tenant users to notify
        const users = await this.findTenantUsers(tenant._id, lease.tenantId);

        // Send email to each tenant user
        for (const user of users) {
          reminderData.push({
            recipientName: tenant.name,
            recipientEmail: user.email,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            amount: transaction.amount,
            dueDate: transaction.dueDate,
            periodStartDate: rentalPeriod.startDate,
            periodEndDate: rentalPeriod.endDate,
            paymentUrl: `${process.env.FRONTEND_URL}/tenant/payments/${transaction._id}`,
          });
        }
      }

      // Send all reminders
      if (reminderData.length > 0) {
        await this.paymentEmailService.sendBulkPaymentReminders(reminderData);
        console.log(
          `Sent ${reminderData.length} payment reminder emails for due date ${targetDueDate.toISOString().split('T')[0]}`,
        );
      }
    } catch (error) {
      console.error('Failed to send payment due reminders:', error);
    }
  }

  /**
   * Send payment overdue notices for transactions that are 2 days past due
   * @param baseDate Optional reference date (defaults to today)
   */
  async sendPaymentOverdueNotices(baseDate?: Date): Promise<void> {
    try {
      // Use provided baseDate or default to today
      const referenceDate = baseDate ? new Date(baseDate) : new Date();

      // Calculate the target due date (2 days before reference date)
      const targetDueDate = addDaysToDate(referenceDate, -2);

      // Set start and end of the target day
      const startOfDay = new Date(targetDueDate);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(targetDueDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Find all pending transactions due on the target date
      const transactions = await this.transactionModel
        .find({
          status: PaymentStatus.PENDING,
          dueDate: {
            $gte: startOfDay,
            $lte: endOfDay,
          },
        })
        .populate({
          path: 'lease',
          select: 'unit tenant lateFee tenantId',
          populate: [
            {
              path: 'unit',
              select: 'unitNumber type',
              populate: { path: 'property', select: 'name address' },
            },
            { path: 'tenant', select: 'name email' },
          ],
        })
        .populate('rentalPeriod', 'startDate endDate rentAmount')
        .exec();

      if (transactions.length === 0) {
        console.log(
          `No overdue notices to send for due date ${targetDueDate.toISOString().split('T')[0]}`,
        );
        return;
      }

      // Process each transaction and send overdue notice
      const overdueData = [];

      for (const transaction of transactions) {
        const lease = transaction.lease as any;
        const tenant = lease.tenant as any;
        const unit = lease.unit as any;
        const property = unit.property as any;
        const rentalPeriod = transaction.rentalPeriod as any;

        // Calculate days late
        const daysLate = 2; // Fixed at 2 days for this notification

        // Calculate late fee if applicable
        const lateFee = lease.lateFee || 0;
        const totalDue = transaction.amount + lateFee;

        // Find tenant users to notify
        const users = await this.findTenantUsers(tenant._id, lease.tenantId);

        // Send email to each tenant user
        for (const user of users) {
          overdueData.push({
            recipientName: tenant.name,
            recipientEmail: user.email,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            amount: transaction.amount,
            dueDate: transaction.dueDate,
            periodStartDate: rentalPeriod.startDate,
            periodEndDate: rentalPeriod.endDate,
            daysLate,
            lateFee,
            totalDue,
            paymentUrl: `${process.env.FRONTEND_URL}/tenant/payments/${transaction._id}`,
          });
        }
      }

      // Send all overdue notices
      if (overdueData.length > 0) {
        await this.paymentEmailService.sendBulkPaymentOverdueNotices(overdueData);
        console.log(
          `Sent ${overdueData.length} payment overdue notices for due date ${targetDueDate.toISOString().split('T')[0]}`,
        );
      }
    } catch (error) {
      console.error('Failed to send payment overdue notices:', error);
    }
  }

  /**
   * Send payment confirmation email when a payment is processed
   * @param transactionId ID of the processed transaction
   */
  async sendPaymentConfirmation(transactionId: string): Promise<void> {
    try {
      // Find the transaction
      const transaction = await this.transactionModel
        .findById(transactionId)
        .populate({
          path: 'lease',
          select: 'unit tenant tenantId',
          populate: [
            {
              path: 'unit',
              select: 'unitNumber type',
              populate: { path: 'property', select: 'name address' },
            },
            { path: 'tenant', select: 'name' },
          ],
        })
        .populate('rentalPeriod', 'startDate endDate rentAmount')
        .exec();

      if (!transaction || transaction.status !== PaymentStatus.PAID) {
        console.log(`No payment confirmation to send for transaction ${transactionId}`);
        return;
      }

      const lease = transaction.lease as any;
      const tenant = lease.tenant as any;
      const unit = lease.unit as any;
      const property = unit.property as any;
      const rentalPeriod = transaction.rentalPeriod as any;

      // Find tenant users to notify
      const users = await this.findTenantUsers(tenant._id, lease.tenantId);
      console.log(users);
      // Send email to each tenant user
      for (const user of users) {
        await this.paymentEmailService.sendPaymentConfirmationEmail(
          {
            recipientName: tenant.name,
            recipientEmail: user.email,
            propertyName: property.name,
            unitIdentifier: unit.unitNumber,
            amount: transaction.amount,
            paymentDate: transaction.paidAt || new Date(),
            periodStartDate: rentalPeriod.startDate,
            periodEndDate: rentalPeriod.endDate,
            transactionId: transaction._id.toString(),
            paymentMethod: transaction.paymentMethod || 'Online Payment',
            paymentReference: transaction.notes,
            dashboardUrl: `${process.env.FRONTEND_URL}/tenant/payments`,
          },
          { queue: true },
        );
      }

      console.log(`Sent payment confirmation email for transaction ${transactionId}`);
    } catch (error) {
      console.error(`Failed to send payment confirmation for transaction ${transactionId}:`, error);
    }
  }

  private async findTenantUsers(tenantId: string, landlordId: Types.ObjectId): Promise<any[]> {
    try {
      return this.userModel
        .byTenant(landlordId)
        .find({
          party_id: tenantId,
          user_type: 'Tenant',
        })
        .exec();
    } catch (error) {
      console.error('Failed to find tenant users:', error);
      return [];
    }
  }
}
