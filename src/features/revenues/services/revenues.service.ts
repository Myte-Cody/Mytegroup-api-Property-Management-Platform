import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { createDateRangeFilter } from '../../../common/utils/date.utils';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { Lease } from '../../leases/schemas/lease.schema';
import { Transaction } from '../../leases/schemas/transaction.schema';
import { UserDocument } from '../../users/schemas/user.schema';

@Injectable()
export class RevenuesService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: AppModel<Transaction>,
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
  ) {}

  async findAllPaginated(queryDto: any, currentUser: UserDocument): Promise<any> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      type,
      propertyId,
      unitId,
      tenantId,
      leaseId,
      paymentMethod,
      startDate,
      endDate,
    } = queryDto;

    let baseQuery = this.transactionModel.find();

    // Apply filters
    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (type) {
      baseQuery = baseQuery.where({ type });
    }

    if (propertyId) {
      baseQuery = baseQuery.where({ property: propertyId });
    }

    if (unitId) {
      baseQuery = baseQuery.where({ unit: unitId });
    }

    if (leaseId) {
      baseQuery = baseQuery.where({ lease: leaseId });
    }

    if (tenantId) {
      const leasesForTenant = await this.leaseModel.find({ tenant: tenantId }).select('_id').lean();
      const leaseIds = leasesForTenant.map((lease) => lease._id);
      baseQuery = baseQuery.where({ lease: { $in: leaseIds } });
    }

    if (paymentMethod) {
      baseQuery = baseQuery.where({ paymentMethod });
    }

    if (startDate || endDate) {
      const dateFilter = createDateRangeFilter(startDate, endDate);
      baseQuery = baseQuery.where({ dueDate: dateFilter });
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
        .populate('property', 'name address')
        .populate('unit', 'unitNumber type')
        .populate({
          path: 'lease',
          select: 'tenant',
          populate: { path: 'tenant', select: 'name email phone' },
        })
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    return createPaginatedResponse(transactions, total, page, limit);
  }

  async findOne(id: string, currentUser: UserDocument) {
    const transaction = await this.transactionModel
      .findById(id)
      .populate('property', 'name address')
      .populate('unit', 'unitNumber type')
      .populate({
        path: 'lease',
        select: 'tenant terms',
        populate: { path: 'tenant', select: 'name email phone' },
      })
      .exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async create(createRevenueDto: any, currentUser: UserDocument) {
    await this.validateRevenueCreation(createRevenueDto);

    // Auto-populate property and unit from lease if not provided
    if (createRevenueDto.lease && (!createRevenueDto.property || !createRevenueDto.unit)) {
      const lease = await this.leaseModel
        .findById(createRevenueDto.lease)
        .populate('unit', '_id')
        .populate({
          path: 'unit',
          select: 'property',
          populate: { path: 'property', select: '_id' },
        })
        .exec();

      if (lease) {
        const unit = lease.unit as any;
        if (!createRevenueDto.unit && unit) {
          createRevenueDto.unit = unit._id;
        }
        if (!createRevenueDto.property && unit && unit.property) {
          createRevenueDto.property = unit.property._id || unit.property;
        }
      }
    }

    const newTransaction = new this.transactionModel(createRevenueDto);
    return await newTransaction.save();
  }

  async update(id: string, updateRevenueDto: any, currentUser: UserDocument) {
    if (!updateRevenueDto || Object.keys(updateRevenueDto).length === 0) {
      throw new BadRequestException('Update data cannot be empty');
    }

    const existingTransaction = await this.transactionModel.findById(id).exec();

    if (!existingTransaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    Object.assign(existingTransaction, updateRevenueDto);
    return await existingTransaction.save();
  }

  async remove(id: string, currentUser: UserDocument) {
    const transaction = await this.transactionModel.findById(id).exec();

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    if (transaction.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending transactions can be deleted');
    }

    await this.transactionModel.deleteById(id);
    return { message: 'Transaction deleted successfully' };
  }

  async getRevenueSummary(currentUser: UserDocument) {
    const transactions = await this.transactionModel.find().exec();

    const summary = {
      totalTransactions: transactions.length,
      totalRevenue: transactions
        .filter((t) => t.status === PaymentStatus.PAID)
        .reduce((sum, t) => sum + t.amount, 0),
      pendingRevenue: transactions
        .filter((t) => t.status === PaymentStatus.PENDING)
        .reduce((sum, t) => sum + t.amount, 0),
      overdueRevenue: transactions
        .filter((t) => t.status === PaymentStatus.OVERDUE)
        .reduce((sum, t) => sum + t.amount, 0),
      byType: {
        [PaymentType.RENT]: transactions
          .filter((t) => t.type === PaymentType.RENT && t.status === PaymentStatus.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
        [PaymentType.DEPOSIT]: transactions
          .filter((t) => t.type === PaymentType.DEPOSIT && t.status === PaymentStatus.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
        [PaymentType.FEES]: transactions
          .filter((t) => t.type === PaymentType.FEES && t.status === PaymentStatus.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
        [PaymentType.UTILITIES]: transactions
          .filter((t) => t.type === PaymentType.UTILITIES && t.status === PaymentStatus.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
        [PaymentType.MAINTENANCE]: transactions
          .filter((t) => t.type === PaymentType.MAINTENANCE && t.status === PaymentStatus.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
        [PaymentType.OTHER]: transactions
          .filter((t) => t.type === PaymentType.OTHER && t.status === PaymentStatus.PAID)
          .reduce((sum, t) => sum + t.amount, 0),
      },
    };

    return summary;
  }

  private async validateRevenueCreation(createRevenueDto: any) {
    // Define lease-based payment types
    const leaseBasedTypes = [
      PaymentType.RENT,
      PaymentType.DEPOSIT,
      PaymentType.DEPOSIT_REFUND,
      PaymentType.DEPOSIT_DEDUCTION,
    ];

    // Validate that either lease or property is provided based on payment type
    const isLeaseBasedType = leaseBasedTypes.includes(createRevenueDto.type);

    if (isLeaseBasedType) {
      // For lease-based types, lease is required
      if (!createRevenueDto.lease) {
        throw new BadRequestException(
          'Lease is required for RENT, DEPOSIT, DEPOSIT_REFUND, and DEPOSIT_DEDUCTION payment types',
        );
      }
    } else {
      // For non-lease types, property is required (unit is optional)
      if (!createRevenueDto.property) {
        throw new BadRequestException('Property is required for non-lease payment types');
      }
    }

    // Validate lease exists if provided
    if (createRevenueDto.lease) {
      const lease = await this.leaseModel.findById(createRevenueDto.lease).exec();
      if (!lease) {
        throw new NotFoundException('Lease not found');
      }
    }

    // Validate amount
    if (!createRevenueDto.amount || createRevenueDto.amount <= 0) {
      throw new BadRequestException('Transaction amount must be greater than 0');
    }

    // Validate transaction date
    if (createRevenueDto.paidAt && new Date(createRevenueDto.paidAt) > new Date()) {
      throw new BadRequestException('Transaction date cannot be in the future');
    }
  }
}
