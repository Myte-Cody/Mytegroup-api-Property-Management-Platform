import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import {
  LeaseStatus,
  PaymentCycle,
  PaymentStatus,
  PaymentType,
  RentalPeriodStatus,
} from '../../../common/enums/lease.enum';
import { UnitAvailabilityStatus } from '../../../common/enums/unit.enum';
import { AppModel } from '../../../common/interfaces/app-model.interface';
import { Unit } from '../../properties/schemas/unit.schema';
import { Tenant } from '../../tenants/schema/tenant.schema';
import { UserDocument } from '../../users/schemas/user.schema';
import {
  CreateLeaseDto,
  RenewLeaseDto,
  TerminateLeaseDto,
  UpdateLeaseDto,
  UploadPaymentProofDto,
} from '../dto';
import { LeaseQueryDto } from '../dto/lease-query.dto';
import { PaginatedLeasesResponseDto } from '../dto/lease-response.dto';
import { Lease } from '../schemas/lease.schema';
import { Transaction } from '../schemas/transaction.schema';
import { RentalPeriod } from '../schemas/rental-period.schema';
import { TransactionsService } from './transactions.service';
import { generateTransactionSchedule, calculateTerminationEndDate } from '../utils/transaction-schedule.utils';
import { calculateRentIncrease, validateRenewalStartDate, normalizeToUTCStartOfDay } from '../utils/renewal.utils';
import { getToday } from '../../../common/utils/date.utils';


@Injectable()
export class LeasesService {
  constructor(
    @InjectModel(Lease.name)
    private readonly leaseModel: AppModel<Lease>,
    @InjectModel(RentalPeriod.name)
    private readonly rentalPeriodModel: AppModel<RentalPeriod>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: AppModel<Transaction>,
    @InjectModel(Unit.name)
    private readonly unitModel: AppModel<Unit>,
    @InjectModel(Tenant.name)
    private readonly tenantModel: AppModel<Tenant>,
    private readonly transactionsService: TransactionsService,
  ) {}

  async findAllPaginated(
    leaseQueryDto: LeaseQueryDto,
    currentUser: UserDocument,
  ): Promise<PaginatedLeasesResponseDto> {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      propertyId,
      unitId,
      tenantId,
    } = leaseQueryDto;

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      return {
        data: [],
        meta: {
          total: 0,
          page,
          limit,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
        success: true,
      };
    }

    let baseQuery = this.leaseModel.byTenant(landlordId).find();

    if (search) {
      baseQuery = baseQuery.where({
        $or: [
          { terms: { $regex: search, $options: 'i' } },
          { terminationReason: { $regex: search, $options: 'i' } },
        ],
      });
    }

    if (status) {
      baseQuery = baseQuery.where({ status });
    }

    if (propertyId) {
      const unitsInProperty = await this.unitModel.byTenant(landlordId).find({ property: propertyId }).select('_id').exec();
      const unitIds = unitsInProperty.map(unit => unit._id);
      baseQuery = baseQuery.where({ unit: { $in: unitIds } });
    }

    if (unitId) {
      baseQuery = baseQuery.where({ unit: unitId });
    }

    if (tenantId) {
      baseQuery = baseQuery.where({ tenant: tenantId });
    }

    const sortObj: Record<string, 1 | -1> = {};
    sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [leases, total] = await Promise.all([
      baseQuery
        .clone()
        .sort(sortObj)
        .skip(skip)
        .limit(limit)
        .populate({
          path: 'unit',
          select: 'unitNumber type availabilityStatus',
          populate: { path: 'property', select: 'name address' }
        })
        .populate('tenant', 'name')
        .exec(),
      baseQuery.clone().countDocuments().exec(),
    ]);

    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data: leases as any[],
      meta: {
        total,
        page,
        limit,
        totalPages,
        hasNext,
        hasPrev,
      },
      success: true,
    };
  }

  async findOne(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel
      .byTenant(landlordId)
      .findById(id)
      .populate({
        path: 'unit',
        select: 'unitNumber type availabilityStatus',
        populate: { path: 'property', select: 'name address' }
      })
      .populate('tenant', 'name')
      .exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    return lease;
  }

  async create(createLeaseDto: CreateLeaseDto, currentUser: UserDocument): Promise<Lease> {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Cannot create lease: No tenant context');
    }

    await this.validateLeaseCreation(createLeaseDto, landlordId);

    const LeaseWithTenant = this.leaseModel.byTenant(landlordId);
    const newLease = new LeaseWithTenant(createLeaseDto);
    const savedLease = await newLease.save();

    if (createLeaseDto.status === LeaseStatus.ACTIVE) {
      await this.activateLease(savedLease, landlordId);
    }

    return savedLease;
  }

  async update(
    id: string,
    updateLeaseDto: UpdateLeaseDto,
    currentUser: UserDocument,
  ): Promise<Lease> {
    if (!updateLeaseDto || Object.keys(updateLeaseDto).length === 0) {
      throw new UnprocessableEntityException('Update data cannot be empty');
    }

    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const existingLease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!existingLease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    await this.validateLeaseUpdate(existingLease, updateLeaseDto, landlordId);

    if (updateLeaseDto.paymentCycle && updateLeaseDto.paymentCycle !== existingLease.paymentCycle) {
      await this.handlePaymentCycleChange(existingLease, updateLeaseDto.paymentCycle, landlordId);
    }

    if (updateLeaseDto.status && updateLeaseDto.status !== existingLease.status) {
      await this.handleStatusChange(existingLease, updateLeaseDto.status, landlordId);
    }

    Object.assign(existingLease, updateLeaseDto);
    return await existingLease.save();
  }

  async terminate(
    id: string,
    terminationData: TerminateLeaseDto,
    currentUser: UserDocument,
  ): Promise<Lease> {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    // Validate that lease is active
    if (lease.status !== LeaseStatus.ACTIVE) {
      throw new BadRequestException(`Cannot terminate lease with status '${lease.status}'. Only active leases can be terminated.`);
    }

    const terminationDate = normalizeToUTCStartOfDay(terminationData.terminationDate);

    const calculatedEndDate = calculateTerminationEndDate(terminationDate, lease.paymentCycle);

    lease.status = LeaseStatus.TERMINATED;
    lease.terminationDate = terminationDate;

    if (terminationData.terminationReason) {
      lease.terminationReason = terminationData.terminationReason;
    }

    const currentRentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE })
      .exec();

    if (currentRentalPeriod) {
      currentRentalPeriod.endDate = calculatedEndDate;
      currentRentalPeriod.status = RentalPeriodStatus.EXPIRED;
      await currentRentalPeriod.save();
    }

    await this.transactionModel.delete({
      lease: id,
      status: PaymentStatus.PENDING,
      dueDate: { $gt: terminationDate }
    });

    // Delete rental periods that start after the termination date
    await this.rentalPeriodModel.delete({
      lease: id,
      startDate: { $gt: terminationDate }
    });

    await this.unitModel.byTenant(landlordId).findByIdAndUpdate(lease.unit, {
      availabilityStatus: UnitAvailabilityStatus.VACANT,
    });

    return await lease.save();
  }

  async renewLease(
    id: string,
    renewalData: RenewLeaseDto,
    currentUser: UserDocument,
  ): Promise<{ lease: Lease; newRentalPeriod: RentalPeriod }> {
    // todo DB transaction
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    // Get current active rental period
    const currentRentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findOne({ lease: id, status: RentalPeriodStatus.ACTIVE })
      .exec();

    if (!currentRentalPeriod) {
      throw new UnprocessableEntityException('No active rental period found for renewal');
    }

    try {
      validateRenewalStartDate(new Date(renewalData.startDate), new Date(currentRentalPeriod.endDate));
    } catch (error) {
      throw new UnprocessableEntityException(error.message);
    }

    const rentCalculation = calculateRentIncrease(lease);
    const newRentAmount = rentCalculation.newRentAmount;
    let appliedRentIncrease = null;

    if (rentCalculation.rentIncrease) {
      appliedRentIncrease = {
        type: rentCalculation.rentIncrease.type,
        amount: rentCalculation.rentIncrease.amount,
        previousRent: currentRentalPeriod.rentAmount,
      };
    }

    // currentRentalPeriod.status = RentalPeriodStatus.RENEWED;

    try {
      const RentalPeriodWithTenant = this.rentalPeriodModel.byTenant(landlordId);
      const newRentalPeriod = new RentalPeriodWithTenant({
        lease: id,
        startDate: normalizeToUTCStartOfDay(renewalData.startDate),
        endDate: normalizeToUTCStartOfDay(renewalData.endDate),
        rentAmount: newRentAmount,
        status: RentalPeriodStatus.PENDING,
        appliedRentIncrease,
        renewedFrom: currentRentalPeriod._id
      });

      const savedNewRentalPeriod = await newRentalPeriod.save();

      currentRentalPeriod.renewedTo = new Types.ObjectId(savedNewRentalPeriod._id.toString());

      lease.endDate = renewalData.endDate;
      lease.rentAmount = newRentAmount;

      const transactionSchedule = generateTransactionSchedule(
        renewalData.startDate,
        renewalData.endDate,
        lease.paymentCycle
      );

      await this.createTransactionsForSchedule(
        id,
        savedNewRentalPeriod._id.toString(),
        lease.tenant.toString(),
        newRentAmount,
        transactionSchedule,
        landlordId
      );

      await currentRentalPeriod.save();
      await lease.save();

      return { lease, newRentalPeriod: savedNewRentalPeriod };
    } catch (error) {
      throw error;
    }
  }

  async remove(id: string, currentUser: UserDocument) {
    const landlordId = this.getLandlordId(currentUser);

    if (!landlordId) {
      throw new ForbiddenException('Access denied: No tenant context');
    }

    const lease = await this.leaseModel.byTenant(landlordId).findById(id).exec();

    if (!lease) {
      throw new NotFoundException(`Lease with ID ${id} not found`);
    }

    if (lease.status !== LeaseStatus.DRAFT) {
      throw new UnprocessableEntityException('Only draft leases can be deleted');
    }

    lease.deleted = true;
    await lease.save();
    return { message: 'Lease deleted successfully' };
  }

  // Helper Methods

  private async validateLeaseCreation(createLeaseDto: CreateLeaseDto, landlordId: Types.ObjectId) {
    const unit = await this.unitModel.byTenant(landlordId).findById(createLeaseDto.unit).exec();
    if (!unit) {
      throw new NotFoundException('Unit not found');
    }

    const tenant = await this.tenantModel
        .byTenant(landlordId)
        .findById(createLeaseDto.tenant)
        .exec();
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (unit.availabilityStatus === UnitAvailabilityStatus.OCCUPIED) {
      const existingActiveLease = await this.leaseModel
        .byTenant(landlordId)
        .findOne({
          unit: createLeaseDto.unit,
          status: { $in: [LeaseStatus.ACTIVE] }
        })
        .exec();

      if (existingActiveLease) {
        throw new UnprocessableEntityException('Unit is currently occupied by another active lease');
      }
    }

    // Check for overlapping leases (dates and cross-field validations handled by DTO)
    await this.validateNoOverlappingLeases(
      createLeaseDto.unit,
      new Date(createLeaseDto.startDate),
      new Date(createLeaseDto.endDate),
      landlordId
    );
  }

  private async validateLeaseUpdate(
    existingLease: Lease,
    updateLeaseDto: UpdateLeaseDto,
    landlordId: Types.ObjectId
  ) {
    // Validate status transition
    if (updateLeaseDto.status && updateLeaseDto.status !== existingLease.status) {
      this.validateStatusTransition(existingLease.status, updateLeaseDto.status);
    }

    if (updateLeaseDto.startDate || updateLeaseDto.endDate) {
      const startDate = new Date(updateLeaseDto.startDate || existingLease.startDate);
      const endDate = new Date(updateLeaseDto.endDate || existingLease.endDate);

      if (existingLease.status === LeaseStatus.ACTIVE) {
        const today = getToday();

        // Don't allow changing start date of active lease to past
        if (updateLeaseDto.startDate && startDate < today) {
          throw new UnprocessableEntityException('Cannot change start date of active lease to a past date');
        }

        // Don't allow end date changes that would terminate lease immediately
        if (updateLeaseDto.endDate && endDate <= today) {
          throw new UnprocessableEntityException('Cannot set end date of active lease to today or past. Use terminate instead');
        }
      }

      // Check for overlapping leases if dates are changing
      const unitIdToValidate = updateLeaseDto.unit || existingLease.unit.toString();
      await this.validateNoOverlappingLeases(
        unitIdToValidate,
        startDate,
        endDate,
        landlordId,
        existingLease._id.toString()
      );
    }

    // Validate unit if changing unit
    if (updateLeaseDto.unit) {
      const unit = await this.unitModel.byTenant(landlordId).findById(updateLeaseDto.unit).exec();
      if (!unit) {
        throw new NotFoundException('Unit not found');
      }

      // Check unit availability if changing unit
      if (updateLeaseDto.unit !== existingLease.unit.toString()) {
        if (unit.availabilityStatus === UnitAvailabilityStatus.OCCUPIED) {
          const existingActiveLease = await this.leaseModel
            .byTenant(landlordId)
            .findOne({
              unit: updateLeaseDto.unit,
              status: { $in: [LeaseStatus.ACTIVE] },
              _id: { $ne: existingLease._id }
            })
            .exec();

          if (existingActiveLease) {
            throw new UnprocessableEntityException('Unit is currently occupied by another active lease');
          }
        }
      }
    }
  }

  private validateStatusTransition(currentStatus: LeaseStatus, newStatus: LeaseStatus) {
    const validTransitions: Record<LeaseStatus, LeaseStatus[]> = {
      [LeaseStatus.DRAFT]: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATED],
      [LeaseStatus.ACTIVE]: [LeaseStatus.EXPIRED, LeaseStatus.TERMINATED, LeaseStatus.RENEWED],
      [LeaseStatus.EXPIRED]: [], // Cannot change status from expired
      [LeaseStatus.TERMINATED]: [], // Cannot change status from terminated
      [LeaseStatus.RENEWED]: [LeaseStatus.EXPIRED, LeaseStatus.TERMINATED], // Renewed can expire or terminate
    };

    const allowedStatuses = validTransitions[currentStatus] || [];
    if (!allowedStatuses.includes(newStatus)) {
      throw new UnprocessableEntityException(
        `Invalid status transition from ${currentStatus} to ${newStatus}. ` +
        `Allowed transitions: ${allowedStatuses.join(', ') || 'none'}`
      );
    }
  }

  private async validateNoOverlappingLeases(
    unitId: string,
    startDate: Date,
    endDate: Date,
    landlordId: Types.ObjectId,
    excludeLeaseId?: string
  ) {
    const query: any = {
      unit: unitId,
      status: { $in: [LeaseStatus.DRAFT, LeaseStatus.ACTIVE] },
      $or: [
        // New lease starts during existing lease period
        {
          startDate: { $lte: startDate },
          endDate: { $gt: startDate }
        },
        // New lease ends during existing lease period
        {
          startDate: { $lt: endDate },
          endDate: { $gte: endDate }
        },
        // New lease completely contains existing lease period
        {
          startDate: { $gte: startDate },
          endDate: { $lte: endDate }
        },
        // Existing lease completely contains new lease period
        {
          startDate: { $lte: startDate },
          endDate: { $gte: endDate }
        }
      ]
    };

    // Exclude current lease from overlap check if updating
    if (excludeLeaseId) {
      query._id = { $ne: excludeLeaseId };
    }

    const overlappingLeases = await this.leaseModel
      .byTenant(landlordId)
      .find(query)
      .exec();

    if (overlappingLeases.length > 0) {
      const overlappingLease = overlappingLeases[0];
      const formatDate = (date: Date) => date.toISOString().split('T')[0];
      throw new UnprocessableEntityException(
        `Unit already has a ${overlappingLease.status.toLowerCase()} lease for the period ${formatDate(overlappingLease.startDate)} to ${formatDate(overlappingLease.endDate)}. ` +
        `The requested period ${formatDate(startDate)} to ${formatDate(endDate)} overlaps with this existing lease.`
      );
    }
  }

  private async activateLease(lease: Lease, landlordId: Types.ObjectId) {
    try {

      const RentalPeriodWithTenant = this.rentalPeriodModel.byTenant(landlordId);
      const initialRentalPeriod = new RentalPeriodWithTenant({
        lease: lease._id,
        startDate: normalizeToUTCStartOfDay(lease.startDate),
        endDate: normalizeToUTCStartOfDay(lease.endDate),
        rentAmount: lease.rentAmount,
        status: RentalPeriodStatus.ACTIVE,
      });

      await initialRentalPeriod.save();

      // Create payment schedule for the initial rental period
      const transactionSchedule = generateTransactionSchedule(
        lease.startDate,
        lease.endDate,
        lease.paymentCycle
      );

      await this.createTransactionsForSchedule(
        lease._id.toString(),
        initialRentalPeriod._id.toString(),
        lease.tenant.toString(),
        lease.rentAmount,
        transactionSchedule,
        landlordId
      );

      if (lease.isSecurityDeposit && lease.securityDepositAmount) {
        await this.createSecurityDepositTransaction(
          lease._id.toString(),
          lease.securityDepositAmount,
          lease.startDate,
          landlordId
        );
      }

      await this.unitModel.byTenant(landlordId).findByIdAndUpdate(lease.unit, {
        availabilityStatus: UnitAvailabilityStatus.OCCUPIED,
      });
    } catch (error) {
      if (
        error.code === 11000 &&
        error.keyPattern &&
        error.keyPattern.lease &&
        error.keyPattern.status
      ) {
        throw new UnprocessableEntityException(
          'Cannot activate lease: An active rental period already exists for this lease.',
        );
      }

      throw error;
    }
  }

  async refundSecurityDeposit(
    leaseId: string,
    refundReason: string,
    currentUser: UserDocument,
  ): Promise<any> {
    const landlordId = this.getLandlordId(currentUser);

    const lease = await this.leaseModel.byTenant(landlordId).findById(leaseId).exec();

    if (!lease) {
      throw new NotFoundException('Lease not found');
    }

    if (!lease.isSecurityDeposit) {
      throw new UnprocessableEntityException('This lease does not have a security deposit');
    }

    if (lease.securityDepositRefundedAt) {
      throw new UnprocessableEntityException('Security deposit has already been refunded');
    }

    const updatedLease = await this.leaseModel
      .byTenant(landlordId)
      .findByIdAndUpdate(
        leaseId,
        {
          securityDepositRefundedAt: new Date(),
          securityDepositRefundReason: refundReason,
        },
        { new: true },
      )
      .populate({
        path: 'unit',
        populate: { path: 'property' }
      })
      .populate('tenant')
      .exec();

    return updatedLease;
  }

  private async handleStatusChange(
    lease: Lease,
    newStatus: LeaseStatus,
    landlordId: Types.ObjectId,
  ) {
    if (newStatus === LeaseStatus.ACTIVE && lease.status === LeaseStatus.DRAFT) {
      await this.activateLease(lease, landlordId);
    }
  }

  private async handlePaymentCycleChange(
    lease: Lease,
    newPaymentCycle: PaymentCycle,
    landlordId: Types.ObjectId,
  ) {
    // Only handle payment cycle changes for active leases
    if (lease.status !== LeaseStatus.ACTIVE) {
      return;
    }

    // Get the current active rental period
    const currentRentalPeriod = await this.rentalPeriodModel
      .byTenant(landlordId)
      .findOne({ lease: lease._id, status: RentalPeriodStatus.ACTIVE })
      .exec();

    if (!currentRentalPeriod) {
      return; // No active rental period, nothing to update
    }

    // Delete all pending transactions for the current rental period
    await this.transactionModel.delete({
      lease: lease._id,
      rentalPeriod: currentRentalPeriod._id,
      status: PaymentStatus.PENDING,
    });

    // Generate new transaction schedule based on the new payment cycle
    // Calculate remaining period: from today to end of current rental period
    const today = new Date();
    const remainingStartDate = today > currentRentalPeriod.startDate ? today : currentRentalPeriod.startDate;

    const transactionSchedule = generateTransactionSchedule(
      remainingStartDate,
      currentRentalPeriod.endDate,
      newPaymentCycle
    );

    // Create new transactions for the remaining period
    await this.createTransactionsForSchedule(
      lease._id.toString(),
      currentRentalPeriod._id.toString(),
      lease.tenant.toString(),
      currentRentalPeriod.rentAmount,
      transactionSchedule,
      landlordId
    );
  }

  async getPaymentForRentalPeriod(
    leaseId: string,
    rentalPeriodId: string,
    currentUser: UserDocument,
  ): Promise<Transaction> {
    return this.transactionsService.getTransactionForRentalPeriod(leaseId, rentalPeriodId, currentUser);
  }

  async submitPaymentProof(
    leaseId: string,
    rentalPeriodId: string,
    submitDto: UploadPaymentProofDto,
    currentUser: UserDocument,
  ): Promise<Transaction> {
    return this.transactionsService.submitTransactionProof(leaseId, rentalPeriodId, submitDto, currentUser);
  }


  private async createTransactionsForSchedule(
    leaseId: string,
    rentalPeriodId: string,
    tenantId: string,
    amount: number,
    dueDates: Date[],
    landlordId: any
  ): Promise<void> {
    const TransactionWithTenant = this.transactionModel.byTenant(landlordId);

    const transactionPromises = dueDates.map(dueDate => {
      const transaction = new TransactionWithTenant({
        lease: leaseId,
        rentalPeriod: rentalPeriodId,
        tenant: tenantId,
        amount: amount,
        type: PaymentType.RENT,
        status: PaymentStatus.PENDING,
        dueDate: dueDate,
      });
      return transaction.save();
    });

    await Promise.all(transactionPromises);
  }

  private async createSecurityDepositTransaction(
    leaseId: string,
    amount: number,
    dueDate: Date,
    landlordId: any
  ): Promise<void> {
    const TransactionWithTenant = this.transactionModel.byTenant(landlordId);

    const securityDepositTransaction = new TransactionWithTenant({
      lease: leaseId,
      amount: amount,
      type: PaymentType.DEPOSIT,
      status: PaymentStatus.PENDING,
      dueDate: dueDate,
      notes: 'Security deposit for lease activation'
    });

    await securityDepositTransaction.save();
  }

  private getLandlordId(currentUser: UserDocument): Types.ObjectId | null {
    if (!currentUser.tenantId) {
      return null;
    }

    return currentUser.tenantId && typeof currentUser.tenantId === 'object'
      ? (currentUser.tenantId as any)._id
      : new Types.ObjectId(currentUser.tenantId);
  }
}
