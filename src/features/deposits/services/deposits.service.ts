import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LeaseStatus, PaymentStatus, PaymentType } from '../../../common/enums/lease.enum';
import { createPaginatedResponse } from '../../../common/utils/pagination.utils';
import { Lease } from '../../leases/schemas/lease.schema';
import { Transaction } from '../../leases/schemas/transaction.schema';
import { UserDocument } from '../../users/schemas/user.schema';
import { DepositQueryDto, DepositStatus } from '../dto/deposit-query.dto';

export interface DepositListItem {
  id: string;
  tenant: { id: string; name: string } | null;
  property: { id: string; name: string } | null;
  unit: { id: string; unitNumber: string } | null;
  depositAmount: number;
  status: DepositStatus;
  paidDate: Date | null;
  returnedAmount: number | null;
  deductedAmount: number | null;
  leaseStatus: LeaseStatus;
}

export interface DepositSummary {
  totalDeposits: number;
  totalAmount: number;
  activeDeposits: number;
  awaitingReturn: number;
  returned: number;
  partiallyReturned: number;
  notPaid: number;
}

@Injectable()
export class DepositsService {
  constructor(
    @InjectModel(Lease.name) private readonly leaseModel: Model<Lease>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<Transaction>,
  ) {}

  async findAllPaginated(queryDto: DepositQueryDto, currentUser: UserDocument): Promise<any> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      propertyId,
      unitId,
      tenantId,
    } = queryDto;

    // Build base query for leases with security deposits
    const baseQuery: any = {
      isSecurityDeposit: true,
      deleted: { $ne: true },
    };

    // Filter by tenant
    if (tenantId) {
      baseQuery.tenant = new Types.ObjectId(tenantId);
    }

    // Filter by unit
    if (unitId) {
      baseQuery.unit = new Types.ObjectId(unitId);
    }

    // Get leases with security deposits
    let leases = await this.leaseModel
      .find(baseQuery)
      .populate('tenant', 'name')
      .populate({
        path: 'unit',
        select: 'unitNumber property',
        populate: { path: 'property', select: 'name' },
      })
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .lean()
      .exec();

    // Filter by property (need to check unit.property)
    if (propertyId) {
      leases = leases.filter((lease: any) => {
        const unit = lease.unit;
        if (!unit || !unit.property) return false;
        return unit.property._id.toString() === propertyId;
      });
    }

    // Get all deposit transactions for these leases
    const leaseIds = leases.map((lease) => lease._id);
    const depositTransactions = await this.transactionModel
      .find({
        lease: { $in: leaseIds },
        type: PaymentType.DEPOSIT,
      })
      .lean()
      .exec();

    // Create a map of lease ID to deposit transaction
    const depositTransactionMap = new Map<string, any>();
    for (const txn of depositTransactions) {
      if (txn.lease) {
        depositTransactionMap.set(txn.lease.toString(), txn);
      }
    }

    // Transform leases to deposit items with computed status
    let depositItems: DepositListItem[] = leases.map((lease: any) => {
      const depositTxn = depositTransactionMap.get(lease._id.toString());
      const depositStatus = this.computeDepositStatus(lease, depositTxn);

      const tenant = lease.tenant as any;
      const unit = lease.unit as any;
      const property = unit?.property as any;

      return {
        id: lease._id.toString(),
        tenant: tenant ? { id: tenant._id.toString(), name: tenant.name } : null,
        property: property ? { id: property._id.toString(), name: property.name } : null,
        unit: unit ? { id: unit._id.toString(), unitNumber: unit.unitNumber } : null,
        depositAmount: lease.securityDepositAmount || 0,
        status: depositStatus,
        paidDate: depositTxn?.paidAt || null,
        returnedAmount: lease.depositAssessment?.finalRefundAmount ?? null,
        deductedAmount: lease.depositAssessment?.totalDeductions ?? null,
        leaseStatus: lease.status,
      };
    });

    // Filter by status if provided
    if (status) {
      depositItems = depositItems.filter((item) => item.status === status);
    }

    // Manual pagination after filtering
    const total = depositItems.length;
    const skip = (page - 1) * limit;
    const paginatedItems = depositItems.slice(skip, skip + limit);

    return createPaginatedResponse(paginatedItems, total, page, limit);
  }

  async findOne(leaseId: string, currentUser: UserDocument): Promise<DepositListItem> {
    const lease = await this.leaseModel
      .findOne({
        _id: leaseId,
        isSecurityDeposit: true,
        deleted: { $ne: true },
      })
      .populate('tenant', 'name')
      .populate({
        path: 'unit',
        select: 'unitNumber property',
        populate: { path: 'property', select: 'name' },
      })
      .lean()
      .exec();

    if (!lease) {
      throw new NotFoundException(`Deposit for lease ${leaseId} not found`);
    }

    const depositTxn = await this.transactionModel
      .findOne({
        lease: leaseId,
        type: PaymentType.DEPOSIT,
      })
      .lean()
      .exec();

    const depositStatus = this.computeDepositStatus(lease, depositTxn);
    const tenant = lease.tenant as any;
    const unit = lease.unit as any;
    const property = unit?.property as any;

    return {
      id: lease._id.toString(),
      tenant: tenant ? { id: tenant._id.toString(), name: tenant.name } : null,
      property: property ? { id: property._id.toString(), name: property.name } : null,
      unit: unit ? { id: unit._id.toString(), unitNumber: unit.unitNumber } : null,
      depositAmount: lease.securityDepositAmount || 0,
      status: depositStatus,
      paidDate: depositTxn?.paidAt || null,
      returnedAmount: lease.depositAssessment?.finalRefundAmount ?? null,
      deductedAmount: lease.depositAssessment?.totalDeductions ?? null,
      leaseStatus: lease.status,
    };
  }

  async getSummary(currentUser: UserDocument): Promise<DepositSummary> {
    // Get all leases with security deposits
    const leases = await this.leaseModel
      .find({
        isSecurityDeposit: true,
        deleted: { $ne: true },
      })
      .lean()
      .exec();

    // Get all deposit transactions for these leases
    const leaseIds = leases.map((lease) => lease._id);
    const depositTransactions = await this.transactionModel
      .find({
        lease: { $in: leaseIds },
        type: PaymentType.DEPOSIT,
      })
      .lean()
      .exec();

    // Create a map of lease ID to deposit transaction
    const depositTransactionMap = new Map<string, any>();
    for (const txn of depositTransactions) {
      if (txn.lease) {
        depositTransactionMap.set(txn.lease.toString(), txn);
      }
    }

    // Calculate summary
    let totalAmount = 0;
    let activeDeposits = 0;
    let awaitingReturn = 0;
    let returned = 0;
    let partiallyReturned = 0;
    let notPaid = 0;

    for (const lease of leases) {
      const depositTxn = depositTransactionMap.get(lease._id.toString());
      const status = this.computeDepositStatus(lease, depositTxn);
      totalAmount += lease.securityDepositAmount || 0;

      switch (status) {
        case DepositStatus.ACTIVE:
          activeDeposits++;
          break;
        case DepositStatus.AWAITING_RETURN:
          awaitingReturn++;
          break;
        case DepositStatus.RETURNED:
          returned++;
          break;
        case DepositStatus.PARTIALLY_RETURNED:
          partiallyReturned++;
          break;
        case DepositStatus.NOT_PAID:
          notPaid++;
          break;
      }
    }

    return {
      totalDeposits: leases.length,
      totalAmount,
      activeDeposits,
      awaitingReturn,
      returned,
      partiallyReturned,
      notPaid,
    };
  }

  private computeDepositStatus(lease: any, depositTransaction: any): DepositStatus {
    // Check if deposit has been refunded
    if (lease.securityDepositRefundedAt) {
      const totalDeductions = lease.depositAssessment?.totalDeductions || 0;
      if (totalDeductions > 0) {
        return DepositStatus.PARTIALLY_RETURNED;
      }
      return DepositStatus.RETURNED;
    }

    // Check if deposit transaction is not paid
    if (!depositTransaction || depositTransaction.status !== PaymentStatus.PAID) {
      return DepositStatus.NOT_PAID;
    }

    // Check if lease has ended and deposit not returned
    if (lease.status === LeaseStatus.TERMINATED || lease.status === LeaseStatus.EXPIRED) {
      return DepositStatus.AWAITING_RETURN;
    }

    // Lease is active and deposit is paid
    return DepositStatus.ACTIVE;
  }
}
