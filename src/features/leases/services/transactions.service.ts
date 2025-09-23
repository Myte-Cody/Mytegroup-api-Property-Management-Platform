import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaymentCycle, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import {
  createEmptyPaginatedResponse,
  createPaginatedResponse,
} from '../../../common/utils/pagination.utils';
import { MediaService } from '../../media/services/media.service';
import { UserDocument } from '../../users/schemas/user.schema';
import { UploadTransactionProofDto } from '../dto';
import { MarkTransactionAsPaidDto } from '../dto/mark-transaction-as-paid.dto';
import { Lease } from '../schemas/lease.schema';
import { Transaction } from '../schemas/transaction.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
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
    private readonly mediaService: MediaService,
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
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
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
              populate: { path: 'property', select: 'name address' }
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
        select: 'unit tenant terms',
        populate: [
          {
            path: 'unit',
            select: 'unitNumber type',
            populate: { path: 'property', select: 'name address' }
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
          lease.paymentCycle
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
    const existingTransaction = await this.transactionModel.byTenant(landlordId).findById(id).exec();

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

    await this.transactionModel.byTenant(landlordId).findByIdAndDelete(id);
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

    const transactions = await this.transactionModel.byTenant(landlordId).find({ lease: leaseId }).exec();

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
      throw new BadRequestException('Transaction proof can only be submitted for pending transactions');
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
}
